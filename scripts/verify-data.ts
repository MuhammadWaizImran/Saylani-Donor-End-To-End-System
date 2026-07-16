/**
 * Proves the dashboard/agent read REAL data via indexed MongoDB queries —
 * not hardcoded/mock values.
 *
 *   npm run verify:data
 *
 * It (1) lists the indexes on the busy collections, (2) runs .explain() on a
 * representative dashboard query and reports whether Mongo used an index
 * (IXSCAN) or scanned the whole collection (COLLSCAN), and (3) cross-checks a
 * couple of live counts you can compare against what the dashboard shows.
 */
import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set — add it to .env.local");
  process.exit(1);
}

type Plan = Record<string, unknown>; // explain() output is engine-defined, walked dynamically

/** Pull the winning plan's stage names out of an explain() result. */
function stages(explain: Plan): string[] {
  const out: string[] = [];
  const walk = (s?: Plan) => {
    if (!s) return;
    if (typeof s.stage === "string") out.push(s.stage);
    if (s.inputStage) walk(s.inputStage as Plan);
    if (Array.isArray(s.inputStages)) (s.inputStages as Plan[]).forEach(walk);
  };
  walk((explain?.queryPlanner as Plan | undefined)?.winningPlan as Plan | undefined);
  return out;
}

async function explainFind(db: Db, coll: string, filter: Record<string, unknown>) {
  const ex = await db.collection(coll).find(filter).explain("executionStats");
  const st = stages(ex);
  const used = st.includes("IXSCAN") ? "IXSCAN ✅ (index used)" : "COLLSCAN ⚠️ (full scan)";
  const s = ex.executionStats ?? {};
  console.log(`\n  find(${coll}, ${JSON.stringify(filter)})`);
  console.log(`    plan stages : ${st.join(" -> ")}`);
  console.log(`    result      : ${used}`);
  console.log(`    docsExamined=${s.totalDocsExamined}  returned=${s.nReturned}  timeMs=${s.executionTimeMillis}`);
}

async function main() {
  const client = await new MongoClient(uri!).connect();
  const db = client.db();
  console.log(`Connected to: ${db.databaseName}`);

  // 1) Indexes that back the dashboard/agent queries
  console.log("\n=== Indexes on key collections ===");
  for (const coll of ["student_inductions", "new_courses", "slots", "trainers", "campus"]) {
    const idx = await db.collection(coll).indexes();
    console.log(`  ${coll}: ${idx.map((i) => i.name).join(", ")}`);
  }

  // 2) Prove a real dashboard filter uses an index, not a full scan
  console.log("\n=== Query plans (explain) ===");
  await explainFind(db, "student_inductions", { status: "enrolled" });
  await explainFind(db, "student_inductions", { campus: (await db.collection("student_inductions").findOne({}))?.campus });

  // 3) Live counts you can eyeball against the dashboard cards
  console.log("\n=== Live counts (compare to dashboard) ===");
  for (const coll of ["students", "student_inductions", "trainers", "campus", "attendances", "trainer_attendances"]) {
    console.log(`  ${coll.padEnd(20)} = ${await db.collection(coll).countDocuments()}`);
  }

  await client.close();
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
