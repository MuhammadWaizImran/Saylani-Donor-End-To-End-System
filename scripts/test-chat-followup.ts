import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { signSession } from "../lib/auth-jwt";
import { mongo } from "../lib/mongodb";

async function main() {
  const userId = `followup-test-${randomUUID()}`;
  const db = await mongo();
  const token = await signSession({ userId, name: "Evaluation", email: "evaluation@example.invalid", role: "admin" });
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  let conversationId: string | undefined;
  try {
    for (const question of [
      "How many enrolments are in student_inductions? Query the database. Text only, no chart.",
      "Check that enrolment count again using the database. Text only, no chart.",
    ]) {
      messages.push({ role: "user", content: question });
      const started = Date.now();
      const response = await fetch(`${process.env.TEST_BASE_URL || "http://localhost:3002"}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(process.env.TEST_STREAM === "1" ? { Accept: "application/x-ndjson" } : {}) },
        body: JSON.stringify({ messages, conversationId }),
        signal: AbortSignal.timeout(120000),
      });
      assert.equal(response.status, 200);
      let result;
      if (process.env.TEST_STREAM === "1") {
        assert.match(response.headers.get("content-type") || "", /application\/x-ndjson/);
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sawStep = false;
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let newline;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const event = JSON.parse(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
            if (event.type === "done") result = event;
            else sawStep = true;
          }
        }
        assert.ok(sawStep, "stream must include progress before completion");
        assert.ok(result, "stream must include a completed answer");
      } else result = await response.json();
      assert.equal(result.mode, "live", result.content);
      const expected = await db.collection("student_inductions").countDocuments();
      assert.match(result.content, new RegExp(`\\b${expected}\\b`));
      assert.match(result.content, /Source: current database queries/);
      messages.push({ role: "assistant", content: result.content });
      conversationId = result.conversationId;
      console.log(JSON.stringify({ turn: messages.length / 2, provider: result.provider, ms: Date.now() - started, verified: true }));
    }
  } finally {
    await db.collection("agent_conversations").deleteMany({ userId });
    await db.collection("portal_ai_charts").deleteMany({ ownerId: userId });
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
