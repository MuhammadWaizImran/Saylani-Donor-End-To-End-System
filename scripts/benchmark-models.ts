import { writeFileSync } from "node:fs";
import {
  requestModel,
  type ModelMessage,
  type ModelTarget,
} from "../lib/ai/providers";
import { buildSystemPrompt } from "../lib/ai/prompt";
import { executeTool, toolDefinitions } from "../lib/ai/tools";
import { initialTools } from "../lib/ai/tool-selection";

const ctx = {
  userId: "model-evaluation",
  userName: "Evaluator",
  userEmail: "",
  role: "admin" as const,
};
const targets: ModelTarget[] = [
  { provider: "gemini", model: "gemini-3.6-flash" },
  { provider: "groq", model: "openai/gpt-oss-120b" },
];
const tests = [
  "How many unique student profiles and enrolments are there? Explain the difference. Query live data.",
  "Give enrolment counts by campus and explain which is largest. Query current data.",
  "What is the average salary of our placed graduates? Explain whether the data supports this and what would be needed.",
  "Mujhe chart bana ke do.",
];
async function main() {
  const results: unknown[] = [];
  for (const target of targets)
    for (const question of tests) {
      if (results.length)
        await new Promise((resolve) => setTimeout(resolve, 65000));
      const started = Date.now();
      const calls: string[] = [];
      const { definitions } = initialTools(question, "trainer");
      const thread: ModelMessage[] = [
        { role: "system", content: buildSystemPrompt(ctx) },
        { role: "user", content: question },
      ];
      try {
        let answer = "";
        for (let round = 0; round < 6; round++) {
          const r = await requestModel(target, thread, definitions);
          thread.push(r.message);
          if (!r.message.tool_calls?.length) {
            answer = r.message.content || "";
            break;
          }
          for (const call of r.message.tool_calls) {
            if (call.function.name === "enable_tools") {
              const names = JSON.parse(call.function.arguments).names;
              for (const name of names) {
                const tool = toolDefinitions.find(
                  (t) =>
                    t.function.name === name &&
                    !/^(create_|update_|delete_|generate_)/.test(name),
                );
                if (tool && !definitions.some((t) => t.function.name === name))
                  definitions.push(tool);
              }
              thread.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ enabled: names }),
              });
              continue;
            }
            if (
              !definitions.some((t) => t.function.name === call.function.name)
            )
              throw new Error("Disallowed evaluation tool");
            calls.push(call.function.name);
            let content: string;
            try {
              content = await executeTool(
                call.function.name,
                JSON.parse(call.function.arguments),
                ctx,
              );
            } catch (e) {
              content = JSON.stringify({ error: (e as Error).message });
            }
            thread.push({ role: "tool", tool_call_id: call.id, content });
          }
        }
        results.push({
          target,
          question,
          ms: Date.now() - started,
          calls,
          answer,
        });
        console.log(
          target.model,
          Date.now() - started + "ms",
          calls.join(","),
          answer.slice(0, 180),
        );
      } catch (e) {
        results.push({
          target,
          question,
          ms: Date.now() - started,
          error: (e as Error).message,
        });
        console.log(target.model, "FAILED", (e as Error).message);
      }
      writeFileSync("model-evaluation.json", JSON.stringify(results, null, 2));
    }
  process.exit(0);
}
main().catch(() => process.exit(1));
