/**
 * FULL-SYSTEM LOAD SEEDER — scales every table with unique, FK-consistent
 * rows while staying inside the Supabase free-tier 500MB budget.
 *
 *   npm run load:seed-all
 *
 * Targets (all rows unique — ids/emails/receipts anchored to a counter):
 *   campuses   +200      (lcp-)   trainers  +5,000  (lt-)
 *   courses    +2,000    (lco-)   classes   +5,000  (lac-)
 *   campaigns  +500      (lc-)    donors    +100,000 (ldn-)
 *   donations  up to +700,000 (ld-) — size-guarded, stops at 470MB
 *
 * Wipe everything with: npm run load:clean
 */
import { Client } from "pg";

const SIZE_LIMIT_MB = 470;

const CITIES = [
  "Karachi","Lahore","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta","Hyderabad","Sialkot",
  "Gujranwala","Bahawalpur","Sargodha","Sukkur","Larkana","Sheikhupura","Mirpur","Abbottabad","Mardan","Kasur",
  "Okara","Sahiwal","Wah Cantt","Dera Ghazi Khan","Jhang","Rahim Yar Khan","Gujrat","Kamoke","Nawabshah","Mingora",
  "Chiniot","Kotri","Khanpur","Hafizabad","Muzaffargarh","Khanewal","Jacobabad","Shikarpur","Attock","Jhelum",
] as const;

const AREAS = [
  "Model Town","Gulshan Block","Johar Colony","Shahrah-e-Faisal Wing","North Extension","Saddar Center",
  "Cantt Branch","University Road Site","Ring Road Complex","City Center","Garden Town","Liaquat Plaza",
] as const;

const SPECIALIZATIONS = [
  "Web & Mobile Development","Python & Machine Learning","Data Analytics","Graphic Design","UI/UX Design",
  "Cloud & DevOps","Cyber Security","Blockchain Development","Game Development","Digital Marketing",
  "E-Commerce","Video Editing","3D Animation","Networking (CCNA)","Database Administration",
  "Flutter Development","MERN Stack","Business Intelligence","AI Prompt Engineering","QA Automation",
] as const;

const COURSE_BASES = [
  "Web Development","App Development","Python Programming","Machine Learning","Data Science","Graphic Design",
  "UI/UX Design","Cloud Computing","Cyber Security","Blockchain","Game Development","Digital Marketing",
  "E-Commerce Management","Video Editing","3D Animation","Networking","Database Design","Flutter",
  "MERN Stack","Business Intelligence","TypeScript Mastery","DevOps Engineering","AI Engineering","QA Testing",
] as const;

const CAMPAIGN_CAUSES = [
  "Flood Relief","Ration Drive","Clean Water Wells","Orphan Education","Free IT Lab","Medical Camp",
  "Winter Blankets","Iftar Program","School Uniforms","Solar Power for Schools","Mobile Clinic","Dialysis Support",
  "Wheelchair Distribution","Eye Surgery Camp","Tree Plantation","Sewing Machines for Widows","Qurbani Meat Share",
  "Books for All","Vocational Training","Emergency Ambulance",
] as const;

const CATEGORIES = ["Education", "Healthcare", "Food Relief", "Clean Water", "Emergency", "Orphan Care"] as const;
const METHODS = ["JazzCash", "Easypaisa", "Bank Transfer", "Card", "Cash"] as const;

const FIRSTS = [
  "Ahmed","Ali","Usman","Bilal","Hamza","Hassan","Fahad","Imran","Zain","Saad","Umar","Adnan","Junaid","Kashif",
  "Rizwan","Salman","Faisal","Danish","Zeeshan","Ibrahim","Yousuf","Abdullah","Owais","Daniyal","Khalid","Yasir",
  "Ayesha","Fatima","Zainab","Maryam","Khadija","Amna","Hira","Sana","Iqra","Areeba","Eman","Rabia","Farah",
  "Sidra","Zoya","Alina","Dua","Fiza","Komal","Madiha","Ramsha","Saba","Zara","Kiran","Momina","Nida",
] as const;
const LASTS = [
  "Khan","Ahmed","Ali","Malik","Sheikh","Qureshi","Siddiqui","Chaudhry","Butt","Mirza","Shah","Hussain","Raza",
  "Abbasi","Ansari","Hashmi","Naqvi","Rizvi","Zaidi","Memon","Soomro","Afridi","Durrani","Awan","Cheema","Bajwa",
  "Gill","Rana","Raja","Bhatti","Mughal","Baloch","Iqbal","Javed","Anwar","Aslam","Aziz","Latif","Akhtar","Amin",
] as const;

const MESSAGES = [
  "May Allah accept this.","For my late father.","Sadaqah jariyah.","Keep up the great work!","Ramzan donation.",
  "For the flood victims.","From our family.","Zakat contribution.","May this help someone in need.","Fi sabilillah.",
] as const;

const arr = (items: readonly string[]) => `array[${items.map((x) => `'${x.replace(/'/g, "''")}'`).join(",")}]`;

async function sizeMb(client: Client): Promise<number> {
  const { rows } = await client.query("select pg_database_size(current_database())/1024/1024 as mb");
  return Number(rows[0].mb);
}

async function run(client: Client, label: string, sql: string) {
  const t0 = Date.now();
  const res = await client.query(sql);
  console.log(`  ✓ ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s, ${res.rowCount ?? 0} rows)`);
}

async function main() {
  const url = process.env.SUPABASE_POOLER_URL;
  if (!url) throw new Error("SUPABASE_POOLER_URL missing in .env.local");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Connected. DB size: ${(await sizeMb(client)).toFixed(0)}MB / limit ${SIZE_LIMIT_MB}MB\n`);

  /* 1 ── campuses +200 (unique city+area combos) */
  await run(client, "campuses +200", `
    insert into campuses (id, name, city, address, established, student_count, trainer_count, course_count, placement_rate, progress_percent)
    select
      'lcp-' || lpad(i::text, 4, '0'),
      'Saylani ' || c.cities[1 + ((i - 1) % array_length(c.cities, 1))] || ' ' || c.areas[1 + ((i - 1) / array_length(c.cities, 1))::int % array_length(c.areas, 1)] || ' Campus',
      c.cities[1 + ((i - 1) % array_length(c.cities, 1))],
      'Plot ' || (100 + i) || ', ' || c.areas[1 + ((i - 1) / array_length(c.cities, 1))::int % array_length(c.areas, 1)],
      (2010 + (i % 16))::text,
      0, 0, 0, 55 + (i % 40), 50 + (i % 45)
    from generate_series(1, 200) i
    cross join (select ${arr(CITIES)}::text[] cities, ${arr(AREAS)}::text[] areas) c
    on conflict (id) do nothing
  `);

  /* 2 ── trainers +5,000 (unique emails; spread over ALL campuses) */
  await run(client, "trainers +5,000", `
    with campus_pool as (select row_number() over (order by id) rn, id from campuses),
         ps as (select count(*)::int n from campus_pool)
    insert into trainers (id, name, email, campus_id, salary, specialization, student_count, batches_count, placed_count, performance_percent, joined_at)
    select
      'lt-' || lpad(i::text, 5, '0'),
      f.a[1 + floor(r.r1 * array_length(f.a, 1))::int] || ' ' || l.a[1 + floor(r.r2 * array_length(l.a, 1))::int],
      'trainer' || i || '@saylani.org',
      cp.id,
      80000 + floor(r.r3 * 34)::int * 5000,
      s.a[1 + floor(r.r4 * array_length(s.a, 1))::int],
      0, 1 + floor(r.r5 * 20)::int, 0, 60 + floor(r.r6 * 40)::int,
      (now() - (floor(r.r7 * 2900)::int || ' days')::interval)::date
    from generate_series(1, 5000) i
    cross join (select ${arr(FIRSTS)}::text[] a) f
    cross join (select ${arr(LASTS)}::text[] a) l
    cross join (select ${arr(SPECIALIZATIONS)}::text[] a) s
    cross join ps
    cross join lateral (select i _i, random() r1, random() r2, random() r3, random() r4, random() r5, random() r6, random() r7, random() r8) r
    join campus_pool cp on cp.rn = 1 + floor(r.r8 * ps.n)::int
    on conflict (id) do nothing
  `);

  /* 3 ── courses +2,000 (unique name via batch number; FK → new trainers' campuses) */
  await run(client, "courses +2,000", `
    with trainer_pool as (select row_number() over (order by id) rn, id, campus_id from trainers where id like 'lt-%'),
         ps as (select count(*)::int n from trainer_pool)
    insert into courses (id, name, campus_id, trainer_id, status, enrolled_count, progress_percent, duration_months, started_at)
    select
      'lco-' || lpad(i::text, 4, '0'),
      b.a[1 + ((i - 1) % array_length(b.a, 1))] || ' — Batch ' || (1 + (i - 1) / array_length(b.a, 1)),
      tp.campus_id,
      tp.id,
      (array['running','completed','upcoming'])[1 + floor(r.r1 * 3)::int],
      0,
      floor(r.r2 * 100)::int,
      3 + floor(r.r3 * 10)::int,
      (now() - (floor(r.r4 * 720)::int || ' days')::interval)::date
    from generate_series(1, 2000) i
    cross join (select ${arr(COURSE_BASES)}::text[] a) b
    cross join ps
    cross join lateral (select i _i, random() r1, random() r2, random() r3, random() r4, random() r5) r
    join trainer_pool tp on tp.rn = 1 + floor(r.r5 * ps.n)::int
    on conflict (id) do nothing
  `);

  /* 4 ── active classes +5,000 (FK-consistent trio via courses) */
  await run(client, "active classes +5,000", `
    with course_pool as (select row_number() over (order by id) rn, id, campus_id, trainer_id from courses),
         ps as (select count(*)::int n from course_pool)
    insert into active_classes (id, name, campus_id, trainer_id, course_id, student_count, timing)
    select
      'lac-' || lpad(i::text, 5, '0'),
      'Section ' || chr(65 + (i % 26)) || '-' || (100 + i),
      cp.campus_id, cp.trainer_id, cp.id,
      15 + floor(r.r1 * 40)::int,
      (array['Mon–Fri','Mon–Wed–Fri','Tue–Thu–Sat','Sat–Sun'])[1 + floor(r.r2 * 4)::int]
        || ' · ' || (8 + floor(r.r3 * 11)::int) || ':00–' || (10 + floor(r.r3 * 11)::int) || ':00'
    from generate_series(1, 5000) i
    cross join ps
    cross join lateral (select i _i, random() r1, random() r2, random() r3, random() r4) r
    join course_pool cp on cp.rn = 1 + floor(r.r4 * ps.n)::int
    on conflict (id) do nothing
  `);

  /* 5 ── campaigns +500 (unique slug/title: cause × city × phase) */
  await run(client, "campaigns +500", `
    insert into campaigns (id, slug, title, tagline, description, story, image_url, gallery, category, location, goal_amount, raised_amount, donor_count, currency, status, created_at, ends_at)
    select
      'lc-' || lpad(i::text, 4, '0'),
      'load-' || i || '-' || lower(replace(c.causes[1 + ((i - 1) % array_length(c.causes, 1))], ' ', '-')),
      c.causes[1 + ((i - 1) % array_length(c.causes, 1))] || ' — ' || t.cities[1 + ((i - 1) / array_length(c.causes, 1))::int % array_length(t.cities, 1)] || ' Phase ' || (1 + (i - 1) / 800),
      'Serving ' || t.cities[1 + ((i - 1) / array_length(c.causes, 1))::int % array_length(t.cities, 1)] || ' with dignity.',
      'Load-test campaign #' || i || ': ' || c.causes[1 + ((i - 1) % array_length(c.causes, 1))] || ' initiative for deserving families.',
      array['Load-test campaign #' || i || ' story.'],
      '/media/hands-giving.avif',
      array['/media/hands-giving.avif'],
      (array[${CATEGORIES.map((c) => `'${c}'`).join(",")}])[1 + (i % 6)],
      t.cities[1 + ((i - 1) / array_length(c.causes, 1))::int % array_length(t.cities, 1)],
      500000 + (i % 20) * 250000,
      0, 0, 'PKR',
      case when i % 7 = 0 then 'urgent' else 'active' end,
      now() - ((i % 400) || ' days')::interval,
      now() + ((30 + i % 300) || ' days')::interval
    from generate_series(1, 500) i
    cross join (select ${arr(CAMPAIGN_CAUSES)}::text[] causes) c
    cross join (select ${arr(CITIES)}::text[] cities) t
    on conflict (id) do nothing
  `);

  /* 6 ── donors +100,000 (unique emails/phones) */
  await run(client, "donors +100,000", `
    insert into donors (id, name, email, phone, total_donated, donation_count, member_since)
    select
      'ldn-' || lpad(i::text, 6, '0'),
      f.a[1 + floor(r.r1 * array_length(f.a, 1))::int] || ' ' || l.a[1 + floor(r.r2 * array_length(l.a, 1))::int],
      'donor' || i || '@' || (array['gmail.com','outlook.com','yahoo.com'])[1 + (i % 3)],
      '03' || lpad((200000000 + i)::text, 9, '0'),
      0, 0,
      (now() - (floor(r.r3 * 1800)::int || ' days')::interval)::date
    from generate_series(1, 100000) i
    cross join (select ${arr(FIRSTS)}::text[] a) f
    cross join (select ${arr(LASTS)}::text[] a) l
    cross join lateral (select i _i, random() r1, random() r2, random() r3) r
    on conflict (id) do nothing
  `);

  /* 7 ── donations — size-guarded batches of 100k, target 700k */
  await run(client, "donations indexes", `
    create index if not exists idx_donations_campaign on donations (campaign_id);
    create index if not exists idx_donations_created on donations (created_at desc);
  `);
  const BATCH = 100_000;
  const TARGET = 700_000;
  let seeded = 0;
  for (let from = 1; from <= TARGET; from += BATCH) {
    const mb = await sizeMb(client);
    if (mb > SIZE_LIMIT_MB) {
      console.log(`  ⚠ size guard: ${mb.toFixed(0)}MB > ${SIZE_LIMIT_MB}MB — stopping donations at ${seeded.toLocaleString()}`);
      break;
    }
    const to = from + BATCH - 1;
    await run(client, `donations ${from.toLocaleString()}–${to.toLocaleString()} (db ${mb.toFixed(0)}MB)`, `
      with campaign_pool as (select row_number() over (order by id) rn, id from campaigns),
           ps as (select count(*)::int n from campaign_pool)
      insert into donations (id, campaign_id, donor_id, donor_name, amount, currency, is_anonymous, message, method, receipt_no, status, created_at)
      select
        'ld-' || lpad(i::text, 7, '0'),
        cp.id,
        null,
        case when r.r1 < 0.08 then 'Anonymous'
             else f.a[1 + floor(r.r2 * array_length(f.a, 1))::int] || ' ' || l.a[1 + floor(r.r3 * array_length(l.a, 1))::int] end,
        (array[500,1000,1500,2000,2500,5000,7500,10000,15000,20000,25000,50000,75000,100000,150000,200000])[1 + floor(r.r4 * 16)::int] + (i % 97),
        'PKR',
        r.r1 < 0.08,
        case when r.r5 < 0.15 then m.a[1 + floor(r.r6 * array_length(m.a, 1))::int] else null end,
        (array[${METHODS.map((x) => `'${x}'`).join(",")}])[1 + floor(r.r7 * 5)::int],
        'RCPT-' || lpad(i::text, 8, '0'),
        'completed',
        now() - (floor(r.r8 * 730 * 24 * 60)::int || ' minutes')::interval
      from generate_series(${from}, ${to}) i
      cross join (select ${arr(FIRSTS)}::text[] a) f
      cross join (select ${arr(LASTS)}::text[] a) l
      cross join (select ${arr(MESSAGES)}::text[] a) m
      cross join ps
      cross join lateral (select i _i, random() r1, random() r2, random() r3, random() r4, random() r5, random() r6, random() r7, random() r8, random() r9) r
      join campaign_pool cp on cp.rn = 1 + floor(r.r9 * ps.n)::int
      on conflict (id) do nothing
    `);
    seeded += BATCH;
  }

  /* 8 ── recompute ALL counters from real data */
  console.log("Recomputing counters…");
  await run(client, "campaign raised/donor counts", `
    update campaigns c set raised_amount = coalesce(s.total, 0) + case when c.id like 'lc-%' then 0 else c.raised_amount end,
                           donor_count = coalesce(s.donors, 0) + case when c.id like 'lc-%' then 0 else c.donor_count end
    from campaigns c2
    left join (select campaign_id, sum(amount)::bigint total, count(*)::int donors from donations where id like 'ld-%' group by campaign_id) s
      on s.campaign_id = c2.id
    where c.id = c2.id
  `);
  await run(client, "campus student/trainer/course counts", `
    update campuses c set
      student_count = coalesce(st.n, 0),
      trainer_count = coalesce(tr.n, 0),
      course_count = coalesce(co.n, 0)
    from campuses c2
    left join (select campus_id, count(*)::int n from students group by campus_id) st on st.campus_id = c2.id
    left join (select campus_id, count(*)::int n from trainers group by campus_id) tr on tr.campus_id = c2.id
    left join (select campus_id, count(*)::int n from courses group by campus_id) co on co.campus_id = c2.id
    where c.id = c2.id
  `);
  await run(client, "trainer/course student counts", `
    update trainers t set student_count = coalesce(s.n, 0), placed_count = coalesce(s.p, 0)
    from trainers t2
    left join (select trainer_id, count(*)::int n, count(*) filter (where placement_status='placed')::int p from students group by trainer_id) s
      on s.trainer_id = t2.id
    where t.id = t2.id;
    update courses co set enrolled_count = coalesce(s.n, 0)
    from courses co2
    left join (select course_id, count(*)::int n from students group by course_id) s on s.course_id = co2.id
    where co.id = co2.id;
  `);
  await client.query("analyze");

  /* 9 ── final report */
  const { rows } = await client.query(`
    select
      (select count(*) from students) students,
      (select count(*) from donations) donations,
      (select count(*) from donors) donors,
      (select count(*) from trainers) trainers,
      (select count(*) from courses) courses,
      (select count(*) from active_classes) classes,
      (select count(*) from campaigns) campaigns,
      (select count(*) from campuses) campuses,
      pg_size_pretty(pg_database_size(current_database())) db_size
  `);
  const uniq = await client.query(`
    select
      (select count(distinct email) from donors where id like 'ldn-%') u_donor_emails,
      (select count(*) from donors where id like 'ldn-%') n_donors,
      (select count(distinct receipt_no) from donations where id like 'ld-%') u_receipts,
      (select count(*) from donations where id like 'ld-%') n_donations,
      (select count(distinct email) from trainers where id like 'lt-%') u_trainer_emails,
      (select count(distinct slug) from campaigns where id like 'lc-%') u_slugs
  `);
  console.log("\n✓ FULL-SYSTEM SEED DONE");
  console.log("  Totals:", JSON.stringify(rows[0]));
  console.log("  Uniqueness:", JSON.stringify(uniq.rows[0]));
  await client.end();
}

main().catch((error) => {
  console.error("✗ Seed failed:", error.message);
  process.exit(1);
});
