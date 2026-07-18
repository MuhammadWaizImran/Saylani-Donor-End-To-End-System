/**
 * Creates the indexes that back the dashboard's and AI agent's data-retrieval
 * queries. Both surfaces read through lib/management-api.ts, so a single set of
 * indexes speeds up every list, filter, aggregation, and the agent's tools.
 *
 * Indexes are chosen to match the ACTUAL query shapes in the code — the
 * equality / $in / $ne / $group fields the queries filter and group on. (Note:
 * the search bars use case-insensitive substring $regex, which a plain B-tree
 * index can't accelerate, so we don't create unused "search" indexes here.
 * Auth email lookups are a different case — they're an EXACT match, just
 * case-insensitive, so a collation index below serves them properly instead.)
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
  // Attendance pages: grouped by student/trainer, trainer rows filter out "deleted".
  attendances: [{ student_id: 1 }],
  trainer_attendances: [{ trainer: 1 }, { status: 1 }],
  // Fee payments: joined to students; donations listed newest-first.
  payments: [{ student: 1 }, { status: 1 }],
  donations: [{ createdAt: -1 }],
  // AI Assistant chat history: listed per-user, newest first.
  agent_conversations: [{ userId: 1, updatedAt: -1 }],
};

/**
 * Case-insensitive collation indexes for the auth email lookups (login,
 * signup's duplicate-email check). These queries now match `{ email }`
 * exactly under this same collation instead of an anchored $regex — a plain
 * index can't serve a case-insensitive match, but an index built WITH this
 * collation can, so this is what actually makes those lookups index-backed.
 */
const EMAIL_COLLATION = { locale: "en", strength: 2 } as const;
const EMAIL_COLLATION_PLAN = ["users", "trainers", "portal_donors"];

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

  for (const coll of EMAIL_COLLATION_PLAN) {
    const name = await db.collection(coll).createIndex({ email: 1 }, { collation: EMAIL_COLLATION });
    console.log(`  ${coll.padEnd(20)} ${"email (ci)".padEnd(22)} -> ${name}`);
    created++;
  }

  // JWT revocation list (see lib/auth-jwt.ts): jti is looked up on every
  // authenticated request, and expiresAt is a TTL index — Mongo drops each
  // row automatically once it reaches the token's own expiry, so logged-out
  // entries don't accumulate forever.
  {
    const name = await db.collection("revoked_sessions").createIndex({ jti: 1 }, { unique: true });
    console.log(`  ${"revoked_sessions".padEnd(20)} ${"jti (unique)".padEnd(22)} -> ${name}`);
    created++;
  }
  {
    const name = await db
      .collection("revoked_sessions")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log(`  ${"revoked_sessions".padEnd(20)} ${"expiresAt (TTL)".padEnd(22)} -> ${name}`);
    created++;
  }

  // AI-generated Word reports (GridFS). Downloads filter by owner (metadata.
  // ownerId — see /api/reports/[id]); the TTL on metadata.expiresAt makes the
  // tool's "link expires in 24 hours" promise real by dropping the file doc
  // at that time, so an expired id simply 404s.
  {
    const name = await db.collection("reports.files").createIndex({ "metadata.ownerId": 1 });
    console.log(`  ${"reports.files".padEnd(20)} ${"metadata.ownerId".padEnd(22)} -> ${name}`);
    created++;
  }
  {
    const name = await db
      .collection("reports.files")
      .createIndex({ "metadata.expiresAt": 1 }, { expireAfterSeconds: 0 });
    console.log(`  ${"reports.files".padEnd(20)} ${"metadata.expiresAt(TTL)".padEnd(22)} -> ${name}`);
    created++;
  }

  console.log(`\nDone. ${created} indexes ensured (existing ones were left untouched).`);
  await client.close();
}

main().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
