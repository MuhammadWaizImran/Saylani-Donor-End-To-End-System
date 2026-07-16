/**
 * Creates the indexes that back the dashboard's and AI agent's data-retrieval
 * queries. Both surfaces read through lib/management-api.ts, so a single set of
 * indexes speeds up every list, filter, aggregation, and the agent's tools.
 *
 * Indexes are chosen to match the ACTUAL query shapes in the code — the
 * equality / $in / $ne / $group fields the queries filter and group on. (Note:
 * the search bars use case-insensitive substring $regex, which a plain B-tree
 * index can't accelerate, so we don't create unused "search" indexes here.)
 *
 * createIndex is idempotent — safe to run repeatedly and on every deploy.
 *
 * Run:  npm run db:indexes
 */
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set — add it to .env.local");
  process.exit(1);
}

/** collection -> list of index key specs to ensure. */
const PLAN: Record<string, Array<Record<string, 1 | -1>>> = {
  // Busiest collection: filtered/grouped by campus, trainer, course, status;
  // joined to students by student_id.
  student_inductions: [
    { campus: 1 },
    { trainer: 1 },
    { new_course: 1 },
    { course: 1 },
    { status: 1 },
    { student_id: 1 },
    { campus: 1, status: 1 }, // compound: campus dashboards that also filter by status
  ],
  // Course offerings — filtered by status (running vs completed), campus, course.
  new_courses: [{ status: 1 }, { campus: 1 }, { course: 1 }],
  // Active classes — grouped/filtered by trainer, campus, new_course.
  slots: [{ trainer: 1 }, { campus: 1 }, { new_course: 1 }],
  // Campus list resolves its city; trainers filtered by campus.
  campus: [{ city: 1 }],
  trainers: [{ campus: 1 }],
};

async function main() {
  const client = await new MongoClient(uri!).connect();
  const db = client.db();
  console.log(`Ensuring indexes on ${db.databaseName}…\n`);

  let created = 0;
  for (const [coll, specs] of Object.entries(PLAN)) {
    for (const keys of specs) {
      const name = await db.collection(coll).createIndex(keys);
      const label = Object.keys(keys).join("+");
      console.log(`  ${coll.padEnd(20)} ${label.padEnd(22)} -> ${name}`);
      created++;
    }
  }

  console.log(`\nDone. ${created} indexes ensured (existing ones were left untouched).`);
  await client.close();
}

main().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
