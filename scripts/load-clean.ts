/**
 * Removes ALL load-test rows (every table) and recomputes counters.
 *
 *   npm run load:clean
 *
 * Load-test id prefixes: ls- (students), ld- (donations), ldn- (donors),
 * lc- (campaigns), lt- (trainers), lco- (courses), lac- (classes),
 * lcp- (campuses). Deletion order respects FKs.
 */
import { Client } from "pg";

async function main() {
  const url = process.env.SUPABASE_POOLER_URL;
  if (!url) {
    console.error("✗ SUPABASE_POOLER_URL missing in .env.local");
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const wipe = async (table: string, prefix: string) => {
    const { rowCount } = await client.query(`delete from ${table} where id like '${prefix}%'`);
    console.log(`  ✓ ${table}: ${rowCount?.toLocaleString()} rows removed`);
  };

  console.log("Deleting load-test rows (FK-safe order)…");
  await wipe("donations", "ld-");
  await wipe("students", "ls-");
  await wipe("active_classes", "lac-");
  await wipe("courses", "lco-");
  await wipe("campaigns", "lc-");
  await wipe("trainers", "lt-");
  await wipe("campuses", "lcp-");
  await wipe("donors", "ldn-");

  console.log("Recomputing counters…");
  await client.query(`
    update campuses c set
      student_count = coalesce(st.n, 0),
      trainer_count = coalesce(tr.n, 0),
      course_count = coalesce(co.n, 0),
      placement_rate = coalesce(st.rate, 0)
    from campuses c2
    left join (
      select campus_id, count(*)::int n,
             round(100.0 * count(*) filter (where placement_status = 'placed') / greatest(count(*), 1))::int rate
      from students group by campus_id
    ) st on st.campus_id = c2.id
    left join (select campus_id, count(*)::int n from trainers group by campus_id) tr on tr.campus_id = c2.id
    left join (select campus_id, count(*)::int n from courses group by campus_id) co on co.campus_id = c2.id
    where c.id = c2.id;

    update courses co set enrolled_count = coalesce(s.n, 0)
    from courses co2
    left join (select course_id, count(*)::int n from students group by course_id) s on s.course_id = co2.id
    where co.id = co2.id;

    update trainers t set
      student_count = coalesce(s.n, 0),
      placed_count = coalesce(s.p, 0)
    from trainers t2
    left join (
      select trainer_id, count(*)::int n, count(*) filter (where placement_status = 'placed')::int p
      from students group by trainer_id
    ) s on s.trainer_id = t2.id
    where t.id = t2.id;
  `);
  await client.query("vacuum analyze");

  const { rows } = await client.query(`
    select (select count(*) from students) students,
           (select count(*) from donations) donations,
           (select count(*) from campaigns) campaigns,
           pg_size_pretty(pg_database_size(current_database())) size
  `);
  console.log(`✓ Done: ${JSON.stringify(rows[0])}`);
  await client.end();
}

main().catch((error) => {
  console.error("✗ Clean failed:", error.message);
  process.exit(1);
});
