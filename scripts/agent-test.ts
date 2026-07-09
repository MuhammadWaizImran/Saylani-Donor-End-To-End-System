/**
 * End-to-end smoke test for the AI agent (read + write + cleanup).
 *
 *   npx tsx --env-file=.env.local scripts/agent-test.ts
 */
import { executeTool, toolDefinitions } from "../lib/ai/tools";
import type { AgentContext } from "../lib/ai/mock-brain";
import { supabaseServer } from "../lib/supabase";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";
const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(Boolean) as string[];

const ctx: AgentContext = { role: "admin", userName: "Test Admin", userEmail: "admin@saylani.org" };

interface Msg {
  role: string;
  content: string | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

async function runAgent(question: string, system: string): Promise<string> {
  const thread: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: question },
  ];
  for (let round = 0; round < 6; round++) {
    let res: Response | null = null;
    outer: for (const model of [MODEL, "llama-3.3-70b-versatile"]) {
      for (const key of keys) {
        res = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: thread, tools: toolDefinitions, tool_choice: "auto", temperature: 0.4, max_tokens: 1024 }),
        });
        if (res.ok) break outer;
        const body = await res.clone().text();
        console.log(`  (failover ${model}: ${res.status})`);
        if (res.status === 429) {
          const hint = body.match(/try again in ([\d.]+)(m?s)/i);
          const waitMs = hint ? Number(hint[1]) * (hint[2].toLowerCase() === "ms" ? 1 : 1000) : 1500;
          await new Promise((r) => setTimeout(r, Math.min(Math.max(waitMs + 300, 800), 8000)));
        }
      }
    }
    if (!res?.ok) throw new Error(`${res?.status}: ${(await res!.text()).slice(0, 300)}`);
    const reply = (await res.json()).choices[0].message as Msg;
    if (!reply.tool_calls?.length) return reply.content ?? "(empty)";
    thread.push(reply);
    for (const call of reply.tool_calls) {
      console.log(`  → tool: ${call.function.name}(${call.function.arguments.slice(0, 120)})`);
      const result = await executeTool(call.function.name, JSON.parse(call.function.arguments || "{}"), ctx);
      console.log(`    ← ${result.slice(0, 160)}`);
      thread.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return "(hit round limit)";
}

const SYSTEM = [
  `You are an operations agent for SMIT (Pakistani welfare org). Use tools to fetch real data; never invent numbers.`,
  `Admins can create records with create_*/record_* tools. A write only succeeded when the tool returns {"success": true} — report failures honestly.`,
  `Currency is PKR ("Rs. 150,000/month"); NEVER use ₹. Write ONLY in English or Roman Urdu (Latin script); NEVER Hindi/Devanagari.`,
].join("\n");

async function main() {
  console.log("TEST 1 — data check:");
  console.log(await runAgent("Kitne students placed hain aur average salary kya hai?", SYSTEM), "\n");

  console.log("TEST 2 — insert:");
  console.log(
    await runAgent(
      "Add a new student: name 'ZZTEST Agent Smoke', email zztest@example.com, campus Gulshan, course Web and Mobile App Development, trainer Kashif Mehmood",
      SYSTEM,
    ),
    "\n",
  );

  // Verify + cleanup
  const db = supabaseServer();
  const { data } = await db.from("students").select("id,name").eq("name", "ZZTEST Agent Smoke");
  console.log("DB VERIFY:", data?.length ? `FOUND ${data[0].id}` : "NOT FOUND — insert failed!");
  if (data?.length) {
    await db.from("students").delete().eq("id", data[0].id);
    console.log("cleanup: test student deleted");
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
