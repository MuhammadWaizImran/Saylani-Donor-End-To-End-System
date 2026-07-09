/**
 * Seeds the Supabase database over the REST API (service-role key) — no
 * direct Postgres connection/password needed. Tables must already exist
 * (run supabase/schema.sql in the SQL Editor first, or `npm run db:setup`).
 *
 *   npm run db:seed
 */
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function upsert(table: string, rows: Record<string, unknown>[]) {
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

async function main() {
  console.log(`Seeding ${url} …`);

  await upsert(
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

  await upsert("donations", [
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

  // Verify
  for (const table of ["campaigns", "donations", "students", "trainers", "campuses"]) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`verify ${table}: ${error.message}`);
    console.log(`  → ${table}: ${count} rows in database`);
  }
  console.log("\n✓ Database seeded successfully.");
}

main().catch((error) => {
  console.error("✗ Seed failed:", error.message);
  process.exit(1);
});
