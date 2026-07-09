/**
 * One-shot database setup: creates the schema and seeds it from the mock
 * data that has powered the frontend so far.
 *
 *   npm run db:setup
 *
 * Requires DATABASE_URL in .env.local (Supabase → Settings → Database →
 * Connection string → URI). Safe to re-run: schema uses IF NOT EXISTS and
 * seeding upserts by primary key.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";
import { campaigns } from "../lib/mock-data/campaigns";
import { donations } from "../lib/mock-data/donations";
import { donors, myDonations } from "../lib/mock-data/donors";
import {
  activeClasses,
  campuses,
  courses,
  students,
  trainers,
} from "../lib/mock-data/management";

config({ path: join(process.cwd(), ".env.local") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "✗ DATABASE_URL missing. Add it to .env.local (Supabase → Settings → Database → Connection string → URI).",
  );
  process.exit(1);
}

async function upsert(client: Client, table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const updates = columns
      .filter((c) => c !== "id")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");
    await client.query(
      `insert into ${table} (${columns.join(", ")}) values (${placeholders})
       on conflict (id) do update set ${updates}`,
      values,
    );
  }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log("Connected to Postgres.");

  console.log("Applying schema…");
  await client.query(readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8"));
  console.log("  ✓ schema applied");

  console.log("Seeding data…");

  await upsert(
    client,
    "campaigns",
    campaigns.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      tagline: c.tagline,
      description: c.description,
      story: c.story,
      image_url: c.imageUrl,
      gallery: c.gallery,
      category: c.category,
      location: c.location,
      goal_amount: c.goalAmount,
      raised_amount: c.raisedAmount,
      donor_count: c.donorCount,
      currency: c.currency,
      status: c.status,
      created_at: c.createdAt,
      ends_at: c.endsAt,
    })),
  );

  await upsert(
    client,
    "donors",
    donors.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      total_donated: d.totalDonated,
      donation_count: d.donationCount,
      member_since: d.memberSince,
    })),
  );

  await upsert(client, "donations", [
    // Public recent donations (anonymous of donor account)
    ...donations.map((d) => ({
      id: d.id,
      campaign_id: d.campaignId,
      donor_id: null,
      donor_name: d.donorName,
      amount: d.amount,
      currency: d.currency,
      is_anonymous: d.isAnonymous,
      message: d.message ?? null,
      method: null,
      receipt_no: null,
      status: "completed",
      created_at: d.createdAt,
    })),
    // The demo donor's own history (dashboard)
    ...myDonations.map((d) => ({
      id: d.id,
      campaign_id: d.campaignId,
      donor_id: "u1",
      donor_name: "Ahmed Raza",
      amount: d.amount,
      currency: d.currency,
      is_anonymous: false,
      message: null,
      method: d.method,
      receipt_no: d.receiptNo,
      status: d.status,
      created_at: d.createdAt,
    })),
  ]);

  await upsert(
    client,
    "campuses",
    campuses.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      address: c.address,
      established: c.established,
      student_count: c.studentCount,
      trainer_count: c.trainerCount,
      course_count: c.courseCount,
      placement_rate: c.placementRate,
      progress_percent: c.progressPercent,
    })),
  );

  await upsert(
    client,
    "trainers",
    trainers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      campus_id: t.campusId,
      salary: t.salary,
      specialization: t.specialization,
      student_count: t.studentCount,
      batches_count: t.batchesCount,
      placed_count: t.placedCount,
      performance_percent: t.performancePercent,
      joined_at: t.joinedAt,
    })),
  );

  await upsert(
    client,
    "courses",
    courses.map((c) => ({
      id: c.id,
      name: c.name,
      campus_id: c.campusId,
      trainer_id: c.trainerId,
      status: c.status,
      enrolled_count: c.enrolledCount,
      progress_percent: c.progressPercent,
      duration_months: c.durationMonths,
      started_at: c.startedAt,
    })),
  );

  await upsert(
    client,
    "students",
    students.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      campus_id: s.campusId,
      course_id: s.courseId,
      trainer_id: s.trainerId,
      enrollment_status: s.enrollmentStatus,
      progress_percent: s.progressPercent,
      attendance_percent: s.attendancePercent,
      placement_status: s.placementStatus,
      company: s.company ?? null,
      salary: s.salary ?? null,
      placement_date: s.placementDate ?? null,
    })),
  );

  await upsert(
    client,
    "active_classes",
    activeClasses.map((c) => ({
      id: c.id,
      name: c.name,
      campus_id: c.campusId,
      trainer_id: c.trainerId,
      course_id: c.courseId,
      student_count: c.studentCount,
      timing: c.timing,
    })),
  );

  const { rows } = await client.query(
    `select (select count(*) from campaigns) as campaigns,
            (select count(*) from donations) as donations,
            (select count(*) from students)  as students,
            (select count(*) from trainers)  as trainers`,
  );
  console.log("\nDatabase ready:", rows[0]);

  await client.end();
}

main().catch((error) => {
  console.error("✗ Setup failed:", error.message);
  process.exit(1);
});
