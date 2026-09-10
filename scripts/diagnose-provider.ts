import { toolDefinitions } from "../lib/ai/tools";
import { buildSystemPrompt } from "../lib/ai/prompt";
async function main() {
  for (const model of ["gemini-3.8-flash", "gemini-3.6-flash"]) {
    const key = process.env.GEMINI_API_KEY!;
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt({
                userId: "test",
                userName: "Test",
                userEmail: "",
                role: "admin",
              }),
            },
            { role: "user", content: "How many enrolments are there?" },
          ],
          tools: toolDefinitions.filter(
            (t) => !/^(create|update|delete|generate)/.test(t.function.name),
          ),
          max_tokens: 2048,
          reasoning_effort: "low",
        }),
        signal: AbortSignal.timeout(45000),
      },
    );
    const j = await r.json();
    console.log(
      model,
      r.status,
      JSON.stringify(
        j.error ||
          j[0]?.error || {
            calls: j.choices?.[0]?.message?.tool_calls?.map(
              (c: { function: { name: string } }) => c.function.name,
            ),
            content: j.choices?.[0]?.message?.content,
          },
      )
        .replaceAll(key, "[redacted]")
        .slice(0, 1800),
    );
  }
}
main().catch((e) => console.log(e.name));
