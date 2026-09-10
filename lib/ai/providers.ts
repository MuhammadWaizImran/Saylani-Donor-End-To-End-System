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
) {
  const base = target.provider === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY";
  const keys = [process.env[base], process.env[`${base}_2`]].filter(
    (key): key is string => Boolean(key),
  );
  let failure = "No API key configured";
  // One shared deadline per provider, including alternate credentials.
  // A slow service must not consume 45 seconds again on every retry/key.
  const deadline = AbortSignal.timeout(20000);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  for (const key of keys) {
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
        failure = `${target.provider}/${target.model}: HTTP ${res.status}`;
        // Never log response bodies or credentials.
        if ([401, 403, 429].includes(res.status)) continue;
        throw new Error(failure);
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
      failure = deadline.aborted
        ? `${target.provider}: timed out`
        : failure !== "No API key configured"
          ? failure
          : `${target.provider}: request failed`;
      if (signal?.aborted) throw new Error("Request cancelled");
      break;
    }
  }
  throw new Error(failure);
}

export async function callModel(
  messages: ModelMessage[],
  tools: unknown[],
  signal?: AbortSignal,
) {
  const failures: string[] = [];
  for (const target of modelTargets()) {
    try {
      return await requestModel(target, messages, tools, signal);
    } catch (error) {
      if (signal?.aborted) throw new Error("Request cancelled");
      failures.push((error as Error).message);
    }
  }
  throw new Error(failures.join("; ") || "No AI providers configured");
}
