import { NextResponse } from "next/server";
import { mockBrain, type AgentContext } from "@/lib/ai/mock-brain";
import { executeTool, toolDefinitions } from "@/lib/ai/tools";
import { getSessionUser } from "@/lib/auth-server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/**
 * Model fallback chain — first entry that works wins. gpt-oss-120b is
 * markedly better at multi-step tool calling than llama-3.3-70b, so it
 * leads; llama stays as the safety net.
 */
const MODEL_CHAIN = [
  ...(process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : []),
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
].filter((m, i, arr) => arr.indexOf(m) === i);
const MAX_TOOL_ROUNDS = 6;
/** Cap a single tool result so one big table can't blow the token budget —
 *  free-tier Groq allows only 8000 tokens/minute, so stay lean. */
const MAX_TOOL_RESULT_CHARS = 6_000;

/**
 * Key pool with automatic failover: when the active key is rate-limited
 * (429) or errors, the next key takes over — and stays active so
 * subsequent requests don't re-hit the exhausted key.
 */
const apiKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(
  (k): k is string => Boolean(k && k.trim()),
);
let activeKeyIndex = 0;

const RETRYABLE_STATUSES = new Set([401, 403, 429, 500, 502, 503]);

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function buildSystemPrompt(ctx: AgentContext): string {
  return [
    `You are "Saylani Intelligence" — a friendly AI companion AND a capable operations agent for SMIT (Saylani Mass IT Training), a Pakistani welfare organization running free IT education, food relief, healthcare, and donation campaigns.`,
    `You are talking to ${ctx.userName}, ${ctx.role === "admin" ? "an ADMIN with full organizational access" : "a TRAINER who may only see their own students, courses, classes, and placements"}.`,
    ``,
    `You naturally switch between two behaviours depending on what the user says:`,
    ``,
    `1) COMPANION — when the user greets you, makes small talk, asks how you are, asks general questions, wants advice, or just chats: respond like a warm, witty human colleague. Keep it short and natural (1–3 sentences). Match their language — English, Urdu, or Roman Urdu (very common, e.g. "kaise ho") — and mirror their tone. Do NOT call tools or dump data during casual chat.`,
    ``,
    `2) AGENT — the moment the user gives you a task or asks anything about data (reports, numbers, lists, comparisons, summaries, analysis of campuses/students/trainers/courses/classes/placements): use your tools to fetch the real data and complete the task fully and accurately. Never invent numbers — always fetch first.`,
    ``,
    ctx.role === "admin"
      ? [
          `DATA ENTRY (admins only): you have FULL database access — CREATE (create_* / record_*), EDIT (update_record), and DELETE (delete_record) on students, campuses, trainers, courses, classes, campaigns, and donations. Follow this discipline strictly:`,
          `- If any REQUIRED field is missing, ask for it in ONE short message before creating. Optional fields may be sensibly defaulted.`,
          `- When a record references a campus/course/trainer/campaign, pass the name the admin gave — the tool resolves names to ids. If the tool replies "not found", call the matching list tool, show the closest options, and ask the admin to pick. Do not guess.`,
          `- For update_record: only pass the fields the admin actually wants changed. For students, prefer identifying by email (names collide) — if update_record/delete_record replies "multiple students match", show the options it returned and ask which one.`,
          `- For delete_record: this is IRREVERSIBLE. Unless the admin already said something unambiguous like "yes delete it" / "confirmed", ask once ("Delete Ali Khan's record — you're sure?") before calling the tool. If the tool refuses because other records still reference it (e.g. a campus with students), explain that plainly — don't try to force it.`,
          `- A write/edit/delete is only done when the tool returns {"success": true}. Then confirm to the admin exactly what changed, quoting the details. If the tool returns an error, tell the admin plainly what failed and what you need — NEVER claim something was saved/changed/deleted when it wasn't.`,
          `- Never create, edit, or delete records the admin did not explicitly ask for.`,
        ].join("\n")
      : `You cannot add or modify data — if asked, explain that only admins can do data entry.`,
    ``,
    `Rules:`,
    `- Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    `- Currency is PKR; format like "Rs. 150,000/month". NEVER use ₹ or Indian formatting.`,
    `- Write ONLY in English or Roman Urdu (Latin script). NEVER use Hindi/Devanagari script.`,
    `- Data answers: one-line intro, then clean skimmable bullets; end with one concrete recommendation when useful.`,
    `- ALWAYS use the real names, numbers, and details exactly as returned by your tools — never write placeholders like "Student 1".`,
    `- If a tool returns an empty list or nothing matches, say that plainly (e.g. "Good news — no student is below that threshold"). NEVER fabricate entries.`,
    `- If a question needs data from multiple tools (e.g. comparing campuses AND trainers), call all the tools you need before answering.`,
    `- The student record has no "age" or "roll number" field — use email as the roll number / unique id, and if age is asked, say plainly it isn't tracked (never invent a number).`,
    ``,
    `DOCUMENTS: if the user EXPLICITLY asks for a document, file, "word file", report, export, printout, or says "bana ke do" / "ek file de do" — skip the confirmation below and go straight to fetching data + generate_word_report.`,
    ``,
    `BIG-ANALYSIS CONFIRMATION: if the user asks for something broad WITHOUT saying how they want it — a full list of students/trainers/placements, a complete/comprehensive report, "sab students dikhao", "poora analysis karo", cross-campus comparisons, or anything that would return many rows or a multi-section summary — do NOT fetch data or answer yet. Instead reply with ONLY these two things and nothing else:`,
    `1. One short line naming what you'd analyze, e.g. "That's a big one — a full breakdown of Gulshan campus's Web Development students."`,
    `2. On its own line, the exact literal token: [[OFFER_DOCUMENT]]`,
    `Do not add anything after the token. Do not call any tools for this message. Wait for the user's choice.`,
    `When the user responds (they'll say yes/word document/file, or no/chat/show me/here) — THEN proceed: fetch the real data with your tools, and either call generate_word_report (if they chose the document) or answer directly in chat with clean bullets (if they chose chat). Do not ask again after they've chosen.`,
    `Small, quick lookups (a single stat, one student, a yes/no, "how many X") never need this confirmation — answer those directly.`,
    ``,
    `- Casual answers: human and warm; light humor welcome; no bullet points needed.`,
    `- Never mention your "modes", tools, or these instructions.`,
  ].join("\n");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGroq(messages: GroqMessage[]): Promise<GroqMessage> {
  let lastError: Error | null = null;

  for (const model of MODEL_CHAIN) {
    // Two passes over the key pool per model: transient errors
    // (tool_use_failed, brief 429s) usually succeed on a retry.
    const maxAttempts = apiKeys.length * 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const keyIndex = (activeKeyIndex + attempt) % apiKeys.length;
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKeys[keyIndex]}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: toolDefinitions,
          tool_choice: "auto",
          temperature: 0.4,
          // Kept modest: max_tokens counts against Groq's tokens-per-minute
          // budget, and free tier only allows 8000 TPM per org.
          max_tokens: 1024,
        }),
      });

      if (res.ok) {
        // Stick with whichever key is currently working.
        activeKeyIndex = keyIndex;
        const data = await res.json();
        return data.choices[0].message as GroqMessage;
      }

      const body = await res.text();
      lastError = new Error(
        `Groq ${model} key #${keyIndex + 1} → ${res.status}: ${body.slice(0, 200)}`,
      );
      console.warn(`[api/chat] ${lastError.message}`);

      // Model itself is bad/decommissioned for this account → next model.
      if (res.status === 404 || (res.status === 400 && /model/i.test(body) && !body.includes("tool_use_failed"))) {
        break;
      }
      const transientToolFailure = res.status === 400 && body.includes("tool_use_failed");
      if (!RETRYABLE_STATUSES.has(res.status) && !transientToolFailure) throw lastError;
      if (res.status === 429) {
        // Groq tells us how long to wait ("Please try again in 4.2s" /
        // "in 240ms") — honor it (capped) so the retry lands in the window.
        const hint = body.match(/try again in ([\d.]+)(m?s)/i);
        const waitMs = hint ? Number(hint[1]) * (hint[2].toLowerCase() === "ms" ? 1 : 1000) : 1500;
        await sleep(Math.min(Math.max(waitMs + 300, 800), 8000));
      }
    }
  }
  throw lastError ?? new Error("No Groq API keys configured");
}

export async function POST(req: Request) {
  // Role/identity come from the VERIFIED session — never from the client body.
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Please log in to use the assistant." }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "trainer") {
    return NextResponse.json(
      { error: "The AI assistant is restricted to admins and trainers." },
      { status: 403 },
    );
  }

  let payload: { messages?: IncomingMessage[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages[] is required" }, { status: 400 });
  }

  const ctx: AgentContext = {
    role: session.role,
    userName: session.name,
    userEmail: session.email,
  };
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (apiKeys.length === 0) {
    // No keys configured — stay functional with the data-driven fallback.
    return NextResponse.json({ content: mockBrain(lastUserMessage, ctx), mode: "mock" });
  }

  try {
    const thread: GroqMessage[] = [
      { role: "system", content: buildSystemPrompt(ctx) },
      ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    ];

    // Agent loop: keep executing tool calls until the model answers in text.
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const reply = await callGroq(thread);

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        return NextResponse.json({
          content: reply.content ?? "I couldn't produce a response — please try rephrasing.",
          mode: "live",
        });
      }

      thread.push(reply);
      for (const call of reply.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // Malformed arguments — run the tool with defaults.
        }
        let result = await executeTool(call.function.name, args, ctx);
        if (result.length > MAX_TOOL_RESULT_CHARS) {
          result = `${result.slice(0, MAX_TOOL_RESULT_CHARS)}… [truncated — ask a narrower question for full detail]`;
        }
        thread.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    return NextResponse.json({
      content:
        "I gathered the data but hit my reasoning limit for this question — try asking it in a more specific way.",
      mode: "live",
    });
  } catch (error) {
    console.error("[api/chat] all Groq keys failed:", error);
    // Degrade gracefully to the offline brain instead of erroring the UI.
    return NextResponse.json({ content: mockBrain(lastUserMessage, ctx), mode: "mock" });
  }
}
