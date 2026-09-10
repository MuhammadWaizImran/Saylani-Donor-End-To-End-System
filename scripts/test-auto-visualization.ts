import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { signSession } from "../lib/auth-jwt";
import { mongo } from "../lib/mongodb";

async function main() {
  const owner = `agent-test-${randomUUID()}`;
  const db = await mongo();
  const token = await signSession({
    userId: owner,
    name: "Evaluation",
    email: "evaluation@example.invalid",
    role: "admin",
  });
  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
  try {
    const start = Date.now();
    const response = await fetch(base + "/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content:
              process.env.TEST_VISUAL_QUESTION || "Which campuses have the most enrolments, and how big is the difference between them?",
          },
        ],
      }),
      signal: AbortSignal.timeout(240000),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    const summary = {
      ms: Date.now() - start,
      model: result.model,
      provider: result.provider,
      mode: result.mode,
      content: result.content,
      charts: result.charts,
    };
    writeFileSync(
      process.env.EXPECT_NO_VISUAL === "1" ? "text-only-evaluation.json" : "auto-visualization-evaluation.json",
      JSON.stringify(summary, null, 2),
    );
    assert.equal(result.mode, "live", result.content);
    if (process.env.EXPECT_NO_VISUAL === "1") {
      assert.equal(result.charts.length, 0, result.content);
      console.log("PASS text-only answer without unnecessary visualization", summary.ms + "ms");
      return;
    }
    assert.equal(result.charts.length, 1, result.content);
    const chart = result.charts[0];
    assert.ok(["bar", "pie"].includes(chart.type));
    assert.equal(
      chart.rows.reduce(
        (sum: number, r: { value: number }) => sum + r.value,
        0,
      ),
      await db.collection("student_inductions").countDocuments(),
    );
    const saved = await db
      .collection("agent_conversations")
      .findOne({ userId: owner });
    assert.equal(saved?.messages.at(-1).charts[0].id, chart.id);
    console.log(
      "PASS unsolicited visualization: AI query → verified chart → explanation → persisted chat history",
      result.model,
      summary.ms + "ms",
    );
  } finally {
    await db.collection("portal_ai_charts").deleteMany({ ownerId: owner });
    await db.collection("agent_conversations").deleteMany({ userId: owner });
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
