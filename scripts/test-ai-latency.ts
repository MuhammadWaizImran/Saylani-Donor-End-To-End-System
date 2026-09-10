import { runAgent } from "../lib/ai/engine";
import { mongo } from "../lib/mongodb";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
async function main() {
  const db = await mongo();
  const profiles = await db.collection("students").countDocuments();
  const enrolments = await db.collection("student_inductions").countDocuments();
  const results = [];
  for (const question of [
    "How many unique student profiles and enrolments are there? Query current data.",
    "What is the average salary of our placed graduates? Explain what data is missing.",
    "Mujhe chart bana ke do.",
  ]) {
    const start = Date.now();
    const steps: unknown[] = [];
    const result = await runAgent(
      [{ role: "user", content: question }],
      {
        userId: "latency-read-evaluation",
        userName: "Evaluator",
        userEmail: "",
        role: "admin",
      },
      (e) => steps.push({ ms: Date.now() - start, ...e }),
      AbortSignal.timeout(90000),
    );
    assert.equal(result.mode, "live", result.content);
    if (question.startsWith("How many")) {
      assert.ok(result.content.includes(String(profiles)));
      assert.ok(result.content.includes(String(enrolments)));
    }
    if (question.startsWith("What")) {
      assert.ok(steps.some((s) => (s as { type: string }).type === "tool"));
      assert.match(result.content, /missing|not|unavailable|cannot|no |lack/i);
    }
    if (question.startsWith("Mujhe")) assert.match(result.content, /\?/);
    const entry = { question, ms: Date.now() - start, ...result, steps };
    results.push(entry);
    console.log(JSON.stringify(entry));
  }
  writeFileSync("latency-evaluation.json", JSON.stringify(results, null, 2));
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
