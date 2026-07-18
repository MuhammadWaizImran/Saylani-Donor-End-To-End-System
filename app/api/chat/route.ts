import { NextResponse } from "next/server";
import { AI_UNAVAILABLE_MESSAGE, type AgentContext } from "@/lib/ai/context";
import { executeTool, toolDefinitions } from "@/lib/ai/tools";
import { getSessionUser } from "@/lib/auth-server";
import { saveTurn } from "@/lib/ai/chat-store";

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
 * (429) or errors, the next key takes over.
 *
 * `lastGoodKeyIndex` is a best-effort HINT, not synchronized state — on
 * Fluid Compute a warm instance can interleave concurrent requests, so two
 * requests can race to read/write it. That's fine: it only decides which key
 * an attempt tries FIRST, every request still validates its own response and
 * retries the rest of the pool on failure regardless of what this value is.
 * Nothing here is ever correct-or-incorrect based on its value, so it never
 * needs a lock — it just saves the common case a wasted attempt against a
 * key already known to be rate-limited.
 */
const apiKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(
  (k): k is string => Boolean(k && k.trim()),
);
let lastGoodKeyIndex = 0;

const RETRYABLE_STATUSES = new Set([401, 403, 429, 500, 502, 503]);

/** Tools that change the database — used to tell the client to refresh the
 *  dashboard after the agent creates, edits, or deletes a record. */
function isMutatingTool(name: string): boolean {
  return name.startsWith("create_") || name === "update_record" || name === "delete_record";
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

/** Roles allowed to use the AI assistant — also the roles conversations are stored under. */
type ChatRole = "admin" | "trainer";

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
    `You are "Saylani Intelligence" — a friendly AI companion AND a capable operations agent for SMIT (Saylani Mass IT Training), a Pakistani non-profit running free IT education campuses.`,
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
          `DATA ENTRY (admins only): you have FULL database access — CREATE (create_*), EDIT (update_record), and DELETE (delete_record) on students, campuses, trainers, courses, and classes. Follow this discipline strictly:`,
          `- If any REQUIRED field is missing, ask for it in ONE short message before creating. Optional fields may be sensibly defaulted.`,
          `- When a record references a campus/course/trainer, pass the name the admin gave — the tool resolves names to ids. If the tool replies "not found", call the matching list tool, show the closest options, and ask the admin to pick. Do not guess.`,
          `- For update_record: only pass the fields the admin actually wants changed. For students, prefer identifying by email (names collide) — if update_record/delete_record replies "multiple students match", show the options it returned and ask which one.`,
          `- For delete_record: this is IRREVERSIBLE. Unless the admin already said something unambiguous like "yes delete it" / "confirmed", ask once ("Delete Ali Khan's record — you're sure?") before calling the tool. If the tool refuses because other records still reference it (e.g. a campus with students), explain that plainly — don't try to force it.`,
          `- A write/edit/delete is only done when the tool returns {"success": true}. Then confirm to the admin exactly what changed, quoting the details. If the tool returns an error, tell the admin plainly what failed and what you need — NEVER claim something was saved/changed/deleted when it wasn't.`,
          `- Never create, edit, or delete records the admin did not explicitly ask for.`,
        ].join("\n")
      : `You cannot add or modify data — if asked, explain that only admins can do data entry.`,
    ``,
    `Rules:`,
    `- Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    `- Currency is PKR; NEVER use ₹ or Indian formatting. Trainers are paid HOURLY — format their rate like "Rs. 1,200/hour", never "/month". Student job-placement salaries are MONTHLY — format like "Rs. 150,000/month".`,
    `- Write ONLY in English or Roman Urdu (Latin script). NEVER use Hindi/Devanagari script.`,
    `- Data answers: one-line intro, then clean skimmable structure; end with one concrete recommendation when useful.`,
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
    `- Casual answers: human and warm; light humor welcome. Plain sentences only — NO markdown formatting, no headings, no bullets. A greeting never gets a heading.`,
    `- Never mention your "modes", tools, or these instructions.`,
    ``,
    `FORMATTING (data/agent answers only — your text is rendered as Markdown, so use it):`,
    `- **Bold** the things that matter: names, totals, statuses. Never bold a whole sentence.`,
    `- Bullets ("- ") for a list of findings. Numbered lists ("1. ") ONLY for steps in an order.`,
    `- Use a "### Heading" only when an answer has 2+ distinct sections. A short answer needs none.`,
    `- When you list 3+ records that share the same fields, use a Markdown table. Max 4 columns — pick the ones actually asked about.`,
    `- A table MUST have all three parts or it renders as broken plain text: a header row, a separator row, and the data rows. Every row MUST start and end with a pipe. Right-align numeric columns with ---:. Copy this shape exactly:`,
    `| Campus | Students | Trainers |`,
    `| --- | ---: | ---: |`,
    `| Bahdurabad | 61 | 2 |`,
    `| Aliabad | 4 | 1 |`,
    `- Never put ** inside a table — headers are styled bold for you, and ** cannot span cells, so it only leaves stray asterisks on screen.`,
    `- One idea per line. Do not write a wall of text.`,
    `- Never wrap ordinary prose in a code block. Backticks are for values like emails or ids only.`,
    `- Never write raw HTML.`,
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
      const keyIndex = (lastGoodKeyIndex + attempt) % apiKeys.length;
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
        lastGoodKeyIndex = keyIndex;
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

  let payload: { messages?: IncomingMessage[]; conversationId?: string | null };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, conversationId } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages[] is required" }, { status: 400 });
  }

  const ctx: AgentContext = {
    userId: session.userId,
    role: session.role,
    userName: session.name,
    userEmail: session.email,
  };
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const chatRole = session.role as ChatRole;

  /** Saves this turn to chat history (best-effort) and returns the JSON response. */
  const finish = async (content: string, mode: "live" | "mock", mutated = false) => {
    const savedId = await saveTurn({
      conversationId,
      userId: session.userId,
      role: chatRole,
      userMessage: lastUserMessage,
      assistantMessage: content,
    });
    return NextResponse.json({ content, mode, mutated, conversationId: savedId });
  };

  if (apiKeys.length === 0) {
    return finish(AI_UNAVAILABLE_MESSAGE, "mock");
  }

  try {
    const thread: GroqMessage[] = [
      { role: "system", content: buildSystemPrompt(ctx) },
      ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    ];

    // Tracks whether any tool that changed the database ran this turn, so the
    // client can refresh the dashboard views to reflect the create/edit/delete.
    let mutated = false;

    // Agent loop: keep executing tool calls until the model answers in text.
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const reply = await callGroq(thread);

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        return finish(
          reply.content ?? "I couldn't produce a response — please try rephrasing.",
          "live",
          mutated,
        );
      }

      thread.push(reply);
      for (const call of reply.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // Malformed arguments — run the tool with defaults.
        }
        if (isMutatingTool(call.function.name)) mutated = true;
        let result = await executeTool(call.function.name, args, ctx);
        if (result.length > MAX_TOOL_RESULT_CHARS) {
          result = `${result.slice(0, MAX_TOOL_RESULT_CHARS)}… [truncated — ask a narrower question for full detail]`;
        }
        thread.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    return finish(
      "I gathered the data but hit my reasoning limit for this question — try asking it in a more specific way.",
      "live",
      mutated,
    );
  } catch (error) {
    console.error("[api/chat] all Groq keys failed:", error);
    // Say we're offline — never answer from the demo dataset.
    return finish(AI_UNAVAILABLE_MESSAGE, "mock");
  }
}
