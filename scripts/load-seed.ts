/**
 * LOAD TEST SEEDER — inserts 1,000,000 unique student rows, generated
 * entirely server-side in Postgres (no data transfer), via the Supabase
 * connection pooler.
 *
 *   npm run load:seed
 *
 * Every row is distinct: unique id/email/phone, varied Pakistani names,
 * random-but-consistent campus→course→trainer trios, realistic status,
 * progress, attendance, and placement (company/salary/date) distributions.
 *
 * Load rows use the id prefix 'ls-' so they can be wiped cleanly:
 *   npm run load:clean
 */
import { Client } from "pg";

const TOTAL = 1_000_000;
const BATCH = 100_000;

const FIRST_NAMES = [
  "Ahmed","Ali","Usman","Bilal","Hamza","Hassan","Hussain","Fahad","Kamran","Imran",
  "Asad","Zain","Talha","Saad","Umar","Farhan","Adnan","Waqas","Junaid","Kashif",
  "Noman","Rizwan","Shahzad","Tariq","Salman","Faisal","Naveed","Arslan","Danish","Shoaib",
  "Zeeshan","Waleed","Moiz","Rehan","Sufyan","Haris","Ibrahim","Yousuf","Abdullah","Mustafa",
  "Anas","Owais","Saif","Taimoor","Shayan","Rayyan","Azan","Daniyal","Ehtisham","Fawad",
  "Ghulam","Habib","Irfan","Jawad","Khalid","Luqman","Mansoor","Nadeem","Obaid","Pervez",
  "Qasim","Rashid","Sajid","Tanveer","Ubaid","Vaqar","Wajahat","Yasir","Zubair","Aftab",
  "Ayesha","Fatima","Zainab","Maryam","Khadija","Amna","Hira","Sana","Iqra","Mahnoor",
  "Areeba","Laiba","Eman","Hafsa","Rabia","Sadia","Farah","Nimra","Kinza","Bushra",
  "Sidra","Tayyaba","Uzma","Warda","Yumna","Zoya","Alina","Bisma","Dua","Esha",
  "Fiza","Gul","Huma","Javeria","Komal","Lubna","Madiha","Nazia","Palwasha","Quratulain",
  "Ramsha","Saba","Tehreem","Urooj","Wajiha","Yusra","Zara","Aiman","Benish","Dania",
  "Erum","Faiza","Ghazala","Hina","Iram","Jasmin","Kanwal","Mehak","Nida","Rida",
  "Samreen","Tuba","Umaima","Zunaira","Anum","Beenish","Fariha","Humaira","Kiran","Momina",
] as const;

const LAST_NAMES = [
  "Khan","Ahmed","Ali","Malik","Sheikh","Qureshi","Siddiqui","Chaudhry","Butt","Mirza",
  "Baig","Shah","Hussain","Raza","Abbasi","Ansari","Farooqi","Hashmi","Jafri","Kazmi",
  "Naqvi","Rizvi","Zaidi","Bukhari","Gillani","Tirmizi","Usmani","Nizami","Dehlavi","Lakhani",
  "Memon","Soomro","Bhutto","Talpur","Junejo","Chandio","Jamali","Magsi","Marri","Bugti",
  "Khattak","Yousafzai","Afridi","Wazir","Mehsud","Orakzai","Bangash","Durrani","Lodhi","Suri",
  "Awan","Gondal","Cheema","Bajwa","Virk","Sandhu","Gill","Sahi","Wattoo","Dogar",
  "Rana","Raja","Bhatti","Tarar","Warraich","Janjua","Mughal","Pathan","Baloch","Rajput",
  "Abbas","Akhtar","Amin","Anwar","Arif","Ashraf","Aslam","Azam","Aziz","Bashir",
  "Dar","Elahi","Fareed","Ghauri","Hamid","Haq","Iqbal","Javed","Kamal","Latif",
] as const;

const COMPANIES = [
  "Systems Limited","Netsol Technologies","10Pearls","Arbisoft","Techlogix","Folio3",
  "Contour Software","VentureDive","Tintash","Confiz","Devsinc","Cubix",
  "GoSaaS","Emumba","Strategic Systems International","TPS Worldwide","Avanza Solutions","Abacus Consulting",
  "Ibex Global","Mindbridge","Motive","Securiti.ai","Educative","Bazaar Technologies",
  "Airlift","Careem","Daraz","Foodpanda","Jazz","Telenor Pakistan",
  "Zong CMPak","Ufone","PTCL","Bank Alfalah Tech","HBL Technology","Meezan Digital",
  "Sadapay","Nayapay","Easypaisa","JazzCash","KTrade","Finja",
  "Zameen.com","PakWheels","Rozee.pk","Bykea","Cheetay","QisstPay",
] as const;

const sqlArray = (items: readonly string[]) =>
  `array[${items.map((n) => `'${n.replace(/'/g, "''")}'`).join(",")}]`;

/** One batch: rows [from, to] — all uniqueness anchored to i. */
const batchSql = (from: number, to: number) => `
with course_pool as (
  select row_number() over (order by id) as idx, id as course_id, campus_id, trainer_id
  from courses
),
pool_size as (select count(*)::int as n from course_pool),
names as (
  select ${sqlArray(FIRST_NAMES)}::text[] as firsts,
         ${sqlArray(LAST_NAMES)}::text[] as lasts,
         ${sqlArray(COMPANIES)}::text[] as companies,
         array['gmail.com','outlook.com','yahoo.com','hotmail.com','proton.me']::text[] as domains
)
insert into students (
  id, name, email, phone, campus_id, course_id, trainer_id,
  enrollment_status, progress_percent, attendance_percent,
  placement_status, company, salary, placement_date
)
select
  'ls-' || lpad(i::text, 7, '0'),
  trim(
    n.firsts[1 + floor(r.r1 * array_length(n.firsts, 1))::int]
    || case when r.r2 < 0.35 then ' ' || n.firsts[1 + floor(r.r3 * array_length(n.firsts, 1))::int] else '' end
    || ' ' || n.lasts[1 + floor(r.r4 * array_length(n.lasts, 1))::int]
  ),
  lower(n.firsts[1 + floor(r.r1 * array_length(n.firsts, 1))::int])
    || '.' || lower(n.lasts[1 + floor(r.r4 * array_length(n.lasts, 1))::int])
    || i || '@' || n.domains[1 + floor(r.r5 * array_length(n.domains, 1))::int],
  '03' || lpad((100000000 + i)::text, 9, '0'),
  cp.campus_id,
  cp.course_id,
  cp.trainer_id,
  case when r.r6 < 0.88 then 'active' else 'inactive' end,
  case
    when r.r7 < 0.12 then 100
    else 10 + floor(r.r8 * 86)::int
  end,
  40 + floor(r.r9 * 60)::int,
  case
    when r.r7 < 0.12 then 'placed'
    when r.r7 < 0.30 then 'seeking'
    else 'studying'
  end,
  case when r.r7 < 0.12
    then n.companies[1 + floor(r.r10 * array_length(n.companies, 1))::int]
    else null end,
  case when r.r7 < 0.12
    then 60000 + floor(r.r11 * 78)::int * 5000
    else null end,
  case when r.r7 < 0.12
    then (now() - (floor(r.r12 * 1095)::int || ' days')::interval)::date
    else null end
from generate_series(${from}, ${to}) as i
cross join names n
cross join pool_size ps
cross join lateral (
  select i as _i, random() r1, random() r2, random() r3, random() r4, random() r5,
         random() r6, random() r7, random() r8, random() r9, random() r10,
         random() r11, random() r12, random() r13
) r
join course_pool cp on cp.idx = 1 + floor(r.r13 * ps.n)::int
on conflict (id) do nothing
`;

const COUNTER_SQL = `
update campuses c set
  student_count = s.total,
  placement_rate = s.rate
from (
  select campus_id, count(*)::int as total,
         round(100.0 * count(*) filter (where placement_status = 'placed') / count(*))::int as rate
  from students group by campus_id
) s where s.campus_id = c.id;

update courses co set enrolled_count = s.total
from (select course_id, count(*)::int as total from students group by course_id) s
where s.course_id = co.id;

update trainers t set
  student_count = s.total,
  placed_count = s.placed
from (
  select trainer_id, count(*)::int as total,
         count(*) filter (where placement_status = 'placed')::int as placed
  from students group by trainer_id
) s where s.trainer_id = t.id;
`;

const INDEX_SQL = `
create index if not exists idx_students_campus on students (campus_id);
create index if not exists idx_students_course on students (course_id);
create index if not exists idx_students_trainer on students (trainer_id);
create index if not exists idx_students_placement on students (placement_status);
create index if not exists idx_students_enrollment on students (enrollment_status);
`;

async function main() {
  const url = process.env.SUPABASE_POOLER_URL;
  if (!url) {
    console.error("✗ SUPABASE_POOLER_URL missing in .env.local");
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected via pooler.");

  const before = await client.query("select count(*) as n from students");
  console.log(`Students before: ${Number(before.rows[0].n).toLocaleString()}`);

  console.log("Ensuring indexes…");
  await client.query(INDEX_SQL);

  const started = Date.now();
  for (let from = 1; from <= TOTAL; from += BATCH) {
    const to = Math.min(from + BATCH - 1, TOTAL);
    const t0 = Date.now();
    await client.query(batchSql(from, to));
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const done = Math.min(to, TOTAL);
    console.log(`  ✓ rows ${from.toLocaleString()}–${to.toLocaleString()} (${secs}s) — ${Math.round((done / TOTAL) * 100)}%`);
  }

  console.log("Recomputing campus/course/trainer counters…");
  await client.query(COUNTER_SQL);

  const after = await client.query(
    `select (select count(*) from students) as students,
            pg_size_pretty(pg_database_size(current_database())) as db_size`,
  );
  const sample = await client.query(
    "select id, name, email, phone, placement_status, company, salary from students where id like 'ls-%' order by random() limit 3",
  );
  console.log(`\n✓ DONE in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  console.log(`  Students now: ${Number(after.rows[0].students).toLocaleString()} · DB size: ${after.rows[0].db_size}`);
  console.log("  Random sample:");
  for (const row of sample.rows) console.log("   ", JSON.stringify(row));

  await client.end();
}

main().catch((error) => {
  console.error("✗ Load seed failed:", error.message);
  process.exit(1);
});
