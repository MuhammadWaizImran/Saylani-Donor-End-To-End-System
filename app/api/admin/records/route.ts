import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth-server";

/**
 * Admin data-entry endpoint (verified Supabase session, admin role only).
 *  GET  → dropdown options (campuses/trainers/courses/campaigns)
 *  POST → validated insert for one entity
 */
async function requireAdmin(req: Request) {
  const session = await getSessionUser(req);
  if (!session) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (session.role !== "admin")
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  return { session };
}

const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

const schemas = {
  campaign: z.object({
    title: z.string().min(4),
    tagline: z.string().min(4),
    description: z.string().min(10),
    category: z.enum(["Education", "Healthcare", "Food Relief", "Clean Water", "Emergency", "Orphan Care"]),
    location: z.string().min(2),
    goal_amount: z.coerce.number().int().positive(),
    status: z.enum(["active", "urgent"]),
    ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    image_url: z.string().min(1).default("/media/hands-giving.avif"),
  }),
  campus: z.object({
    name: z.string().min(3),
    city: z.string().min(2),
    address: z.string().min(5),
    established: z.string().regex(/^\d{4}$/, "Year like 2026"),
  }),
  trainer: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    campus_id: z.string().min(1),
    specialization: z.string().min(2),
    salary: z.coerce.number().int().positive(),
    joined_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  }),
  course: z.object({
    name: z.string().min(3),
    campus_id: z.string().min(1),
    trainer_id: z.string().min(1),
    status: z.enum(["running", "completed", "upcoming"]),
    duration_months: z.coerce.number().int().positive(),
    started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  }),
  student: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    phone: z.string().min(7),
    campus_id: z.string().min(1),
    course_id: z.string().min(1),
    trainer_id: z.string().min(1),
    enrollment_status: z.enum(["active", "inactive"]),
  }),
  active_class: z.object({
    name: z.string().min(3),
    campus_id: z.string().min(1),
    trainer_id: z.string().min(1),
    course_id: z.string().min(1),
    student_count: z.coerce.number().int().nonnegative(),
    timing: z.string().min(4),
  }),
  donation: z.object({
    campaign_id: z.string().min(1),
    donor_name: z.string().min(2),
    amount: z.coerce.number().int().positive(),
    method: z.enum(["JazzCash", "Easypaisa", "Bank Transfer", "Card", "Cash"]),
    is_anonymous: z.coerce.boolean(),
    message: z.string().optional(),
  }),
} as const;

type Entity = keyof typeof schemas;

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const db = supabaseServer();
  const [campuses, trainers, courses, campaigns] = await Promise.all([
    db.from("campuses").select("id,name").order("name"),
    db.from("trainers").select("id,name").order("name"),
    db.from("courses").select("id,name").order("name"),
    db.from("campaigns").select("id,title").order("title"),
  ]);
  const firstError = campuses.error ?? trainers.error ?? courses.error ?? campaigns.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }
  return NextResponse.json({
    campuses: campuses.data ?? [],
    trainers: trainers.data ?? [],
    courses: courses.data ?? [],
    campaigns: (campaigns.data ?? []).map((c) => ({ id: c.id, name: c.title })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: { entity?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entity = body.entity as Entity;
  if (!entity || !(entity in schemas)) {
    return NextResponse.json({ error: `Unknown entity: ${String(body.entity)}` }, { status: 400 });
  }

  const parsed = schemas[entity].safeParse(body.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 422 },
    );
  }

  const db = supabaseServer();

  try {
    switch (entity) {
      case "campaign": {
        const d = parsed.data as z.infer<(typeof schemas)["campaign"]>;
        const id = newId("c");
        const slug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || id;
        const { error } = await db.from("campaigns").insert({
          id, slug, title: d.title, tagline: d.tagline, description: d.description,
          story: [d.description], image_url: d.image_url, gallery: [d.image_url],
          category: d.category, location: d.location, goal_amount: d.goal_amount,
          status: d.status, ends_at: new Date(`${d.ends_at}T23:59:59Z`).toISOString(),
        });
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, id, message: `Campaign "${d.title}" is live.` });
      }
      case "campus": {
        const d = parsed.data as z.infer<(typeof schemas)["campus"]>;
        const id = newId("cp");
        const { error } = await db.from("campuses").insert({ id, ...d });
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, id, message: `Campus "${d.name}" created.` });
      }
      case "trainer": {
        const d = parsed.data as z.infer<(typeof schemas)["trainer"]>;
        const id = newId("t");
        const { error } = await db.from("trainers").insert({ id, ...d });
        if (error) throw new Error(error.message);
        const { data: campus } = await db.from("campuses").select("trainer_count").eq("id", d.campus_id).single();
        if (campus) await db.from("campuses").update({ trainer_count: Number(campus.trainer_count) + 1 }).eq("id", d.campus_id);
        return NextResponse.json({ success: true, id, message: `Trainer "${d.name}" added.` });
      }
      case "course": {
        const d = parsed.data as z.infer<(typeof schemas)["course"]>;
        const id = newId("co");
        const { error } = await db.from("courses").insert({ id, ...d });
        if (error) throw new Error(error.message);
        const { data: campus } = await db.from("campuses").select("course_count").eq("id", d.campus_id).single();
        if (campus) await db.from("campuses").update({ course_count: Number(campus.course_count) + 1 }).eq("id", d.campus_id);
        return NextResponse.json({ success: true, id, message: `Course "${d.name}" created.` });
      }
      case "student": {
        const d = parsed.data as z.infer<(typeof schemas)["student"]>;
        const id = newId("s");
        const { error } = await db.from("students").insert({ id, ...d });
        if (error) throw new Error(error.message);
        const [{ data: campus }, { data: course }, { data: trainer }] = await Promise.all([
          db.from("campuses").select("student_count").eq("id", d.campus_id).single(),
          db.from("courses").select("enrolled_count").eq("id", d.course_id).single(),
          db.from("trainers").select("student_count").eq("id", d.trainer_id).single(),
        ]);
        await Promise.all([
          campus && db.from("campuses").update({ student_count: Number(campus.student_count) + 1 }).eq("id", d.campus_id),
          course && db.from("courses").update({ enrolled_count: Number(course.enrolled_count) + 1 }).eq("id", d.course_id),
          trainer && db.from("trainers").update({ student_count: Number(trainer.student_count) + 1 }).eq("id", d.trainer_id),
        ]);
        return NextResponse.json({ success: true, id, message: `Student "${d.name}" enrolled.` });
      }
      case "active_class": {
        const d = parsed.data as z.infer<(typeof schemas)["active_class"]>;
        const id = newId("ac");
        const { error } = await db.from("active_classes").insert({ id, ...d });
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, id, message: `Class "${d.name}" scheduled.` });
      }
      case "donation": {
        const d = parsed.data as z.infer<(typeof schemas)["donation"]>;
        const id = newId("d");
        const { error } = await db.from("donations").insert({
          id, campaign_id: d.campaign_id,
          donor_name: d.is_anonymous ? "Anonymous" : d.donor_name,
          amount: d.amount, is_anonymous: d.is_anonymous,
          message: d.message || null, method: d.method, status: "completed",
        });
        if (error) throw new Error(error.message);
        const { data: campaign } = await db
          .from("campaigns").select("raised_amount,donor_count").eq("id", d.campaign_id).single();
        if (campaign) {
          await db.from("campaigns").update({
            raised_amount: Number(campaign.raised_amount) + d.amount,
            donor_count: Number(campaign.donor_count) + 1,
          }).eq("id", d.campaign_id);
        }
        return NextResponse.json({
          success: true, id,
          message: `Donation of Rs. ${d.amount.toLocaleString()} recorded — campaign totals updated.`,
        });
      }
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
