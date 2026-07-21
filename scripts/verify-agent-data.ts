/**
 * Read-only contract checks for the AI agent's live-data reporting tools.
 *
 * Run: npm run verify:agent-data
 *
 * This does not insert, update, or delete any MongoDB document. It ensures
 * each tool declares its source collection and returns a structured result
 * instead of a conversational guess.
 */
import { executeTool } from "../lib/ai/tools";

const admin = {
  userId: "verification",
  role: "admin" as const,
  userName: "Verification",
  userEmail: "verification@example.invalid",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(
  name: string,
  tool: string,
  args: Record<string, unknown>,
  expectedCollection: string,
) {
  const raw = await executeTool(tool, args, admin);
  const result = JSON.parse(raw) as {
    error?: string;
    evidence?: { source_collections?: string[]; generated_at?: string };
    rows?: unknown[];
  };
  assert(!result.error, `${name}: ${result.error}`);
  assert(result.evidence?.source_collections?.includes(expectedCollection), `${name}: missing ${expectedCollection} evidence`);
  assert(Boolean(result.evidence?.generated_at), `${name}: missing generated_at evidence`);
  assert(Array.isArray(result.rows), `${name}: rows is not an array`);
  console.log(`  OK ${name} (${result.rows.length} row groups)`);
}

async function main() {
  console.log("Verifying AI tools against live MongoDB (read-only)...");
  await check("fee payments by month", "analyze_fee_payments", { group_by: "month" }, "payments");
  await check("donations by month", "analyze_donations", { group_by: "month" }, "donations");
  await check("student attendance by status", "analyze_attendance", { subject: "student", group_by: "status" }, "attendances");
  await check("result records by status", "analyze_academic_records", { record_type: "results", group_by: "status" }, "results");
  await check("audit logs", "search_audit_logs", { limit: 5 }, "logs");
  console.log("All agent data-tool checks passed.");
  // The app's Mongo singleton intentionally stays open for a web server.
  // This one-off verifier should terminate once its read-only checks finish.
  process.exit(0);
}

main().catch((error) => {
  console.error("Agent data-tool verification failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
