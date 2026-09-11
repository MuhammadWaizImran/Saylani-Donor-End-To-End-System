import { setTimeout as delay } from "node:timers/promises";

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    extra_content?: unknown;
  }>;
  tool_call_id?: string;
}

export interface ModelTarget {
  provider: "gemini" | "groq";
  model: string;
}
interface Failure {
  provider: string;
  status?: number;
  retryAt?: number;
  kind: "rate_limit" | "configuration" | "timeout" | "unavailable";
}
export class ProvidersUnavailable extends Error {
  constructor(public failures: Failure[]) {
    super(failures.map(f => `${f.provider}: ${f.status ? `HTTP ${f.status}` : f.kind}`).join("; ") || "No AI providers configured");
  }
}
// Scoped to a single agent run: no credentials or user data in shared caches.
export interface ProviderSession {
  preferred?: ModelTarget["provider"];
  blocked: Map<string, Failure>;
}
export const createProviderSession = (): ProviderSession => ({ blocked: new Map() });

export function providerErrorMessage(error: unknown): string {
  if (error instanceof ProvidersUnavailable && error.failures.length) {
    const failures = error.failures;
    if (failures.every(f => f.kind === "rate_limit")) {
      const waits = failures.flatMap(f => f.retryAt ? [Math.max(1, Math.ceil((f.retryAt - Date.now()) / 1000))] : []);
      return `AI providers are temporarily rate-limited. ${waits.length ? `Try again in about ${Math.min(...waits)} seconds.` : "Please try again shortly."} This answer was not completed; no database figures have been guessed.`;
    }
    if (failures.some(f => f.kind === "configuration"))
      return "The AI providers could not complete this request, and a fallback provider has an access or configuration error. The administrator needs to check the provider settings. No database figures have been guessed.";
    if (failures.some(f => f.kind === "timeout"))
      return "The AI service took too long to respond. Please retry with a narrower question.";
  }
  return "The AI service is unavailable right now. I could not complete this analysis; please retry. No figures have been guessed.";
}
export const modelTargets = (): ModelTarget[] => {
  const targets: ModelTarget[] = [
    ...(process.env.GEMINI_API_KEY
      ? [
          {
            provider: "gemini" as const,
            model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
          },
        ]
      : []),
    ...(process.env.GROQ_API_KEY
      ? [
          {
            provider: "groq" as const,
            model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
          },
        ]
      : []),
  ];
  const preferred = process.env.AI_PRIMARY_PROVIDER || "groq";
  return targets.sort(
    (a, b) =>
      Number(b.provider === preferred) - Number(a.provider === preferred),
  );
};

export async function requestModel(
  target: ModelTarget,
  messages: ModelMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  session = createProviderSession(),
) {
  const base = target.provider === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY";
  const keys = [...new Set([process.env[base], process.env[`${base}_2`]].filter(
    (key): key is string => Boolean(key),
  ))];
  const failures: Failure[] = [];
  // One shared deadline per provider, including alternate credentials.
  // A slow service must not consume 45 seconds again on every retry/key.
  const deadline = AbortSignal.timeout(20000);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  for (const [index, key] of keys.entries()) {
    if (signal?.aborted) throw new Error("Request cancelled");
    const slot = `${target.provider}/${target.model}/${index}`;
    const blocked = session.blocked.get(slot);
    if (blocked && (!blocked.retryAt || blocked.retryAt > Date.now())) {
      failures.push(blocked);
      continue;
    }
    session.blocked.delete(slot);
    try {
      const res = await fetch(
        target.provider === "gemini"
          ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
          : "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          signal: requestSignal,
          body: JSON.stringify({
            model: target.model,
            messages,
            tools,
            tool_choice: "auto",
            temperature: 0.1,
            max_tokens: target.provider === "groq" ? 2048 : 4096,
            reasoning_effort: "low",
          }),
        },
      );
      if (!res.ok) {
        const retry = res.headers.get("retry-after");
        const seconds = retry === null ? NaN : Number(retry);
        const retryAt = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds * 1000) : Date.parse(retry || "");
        const failure: Failure = {
          provider: target.provider,
          status: res.status,
          kind: res.status === 429 ? "rate_limit" : [400, 401, 403, 404].includes(res.status) ? "configuration" : "unavailable",
          ...(res.status === 429 ? { retryAt: Number.isFinite(retryAt) ? retryAt : Date.now() + 30000 } : {}),
        };
        failures.push(failure);
        session.blocked.set(slot, failure);
        // Only safe status metadata is retained, never bodies or credentials.
        await res.body?.cancel();
        if ([401, 403, 429].includes(res.status)) continue;
        break;
      }
      const data = await res.json();
      const raw = data.choices?.[0]?.message;
      if (!raw || (!raw.content && !raw.tool_calls?.length))
        throw new Error("Empty model response");
      if (data.choices[0].finish_reason === "length")
        throw new Error("Model response exceeded output limit");
      // Keep Gemini thought signatures attached to tool calls across rounds.
      const message: ModelMessage = {
        role: "assistant",
        content: raw.content ?? null,
        ...(raw.tool_calls ? { tool_calls: raw.tool_calls } : {}),
      };
      return {
        message,
        model: target.model,
        provider: target.provider,
        usage: data.usage,
      };
    } catch {
      if (signal?.aborted) throw new Error("Request cancelled");
      failures.push({ provider: target.provider, kind: deadline.aborted ? "timeout" : "unavailable" });
      break;
    }
  }
  throw new ProvidersUnavailable(failures.length ? failures : [{ provider: target.provider, kind: "configuration" }]);
}

export async function callModel(
  messages: ModelMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  session = createProviderSession(),
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const failures: Failure[] = [];
    const targets = modelTargets().sort((a, b) => Number(b.provider === session.preferred) - Number(a.provider === session.preferred));
    for (const target of targets) {
      try {
        const result = await requestModel(target, messages, tools, signal, session);
        session.preferred = result.provider;
        return result;
      } catch (error) {
        if (signal?.aborted) throw new Error("Request cancelled");
        failures.push(...(error instanceof ProvidersUnavailable ? error.failures : [{ provider: target.provider, kind: "unavailable" as const }]));
      }
    }
    const waits = failures.flatMap(f => f.kind === "rate_limit" && f.retryAt ? [Math.max(0, f.retryAt - Date.now())] : []);
    const wait = Math.min(...waits);
    // Retry only this inference after all fallbacks, never replay database tools.
    if (attempt === 0 && wait <= 1500) {
      try { await delay(wait + 25, undefined, { signal }); }
      catch { throw new Error("Request cancelled"); }
      continue;
    }
    throw new ProvidersUnavailable(failures);
  }
  throw new ProvidersUnavailable([]);
}
