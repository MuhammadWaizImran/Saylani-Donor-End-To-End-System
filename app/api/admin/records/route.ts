import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { mongo } from "@/lib/mongodb";
import { getCampuses, getTrainers, getCourses } from "@/lib/management-api";
import { getSessionUser } from "@/lib/auth-server";

/**
 * Admin data-entry endpoint (verified session, admin role only).
 *  GET  → dropdown options (campuses/trainers/courses) from MongoDB
 *  POST → validated insert for one entity into the matching MongoDB collection
 */
async function requireAdmin(req: Request) {
  const session = await getSessionUser(req);
  if (!session) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (session.role !== "admin")
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  return { session };
}

const oid = (id: string): ObjectId | string => (/^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : id);
const rx = (q: string) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const schemas = {
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
} as const;

type Entity = keyof typeof schemas;

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const [campuses, trainers, courses] = await Promise.all([getCampuses(), getTrainers(), getCourses()]);
  return NextResponse.json({
    campuses: campuses.map((c) => ({ id: c.id, name: c.name })),
    trainers: trainers.map((t) => ({ id: t.id, name: t.name })),
    courses: courses.map((c) => ({ id: c.id, name: c.name })),
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
    return NextResponse.json({ error: `${issue.path.join(".")}: ${issue.message}` }, { status: 422 });
  }

  const db = await mongo();

  try {
    switch (entity) {
      case "campus": {
        const d = parsed.data as z.infer<(typeof schemas)["campus"]>;
        const cityDoc = await db.collection("cities").findOne({ "en.city_name": { $regex: `^${rx(d.city)}$`, $options: "i" } });
        const res = await db.collection("campus").insertOne({
          en: { campus_name: d.name, address: d.address }, ur: { campus_name: d.name, address: d.address },
          city: cityDoc?._id ?? null, createdAt: new Date(),
        });
        return NextResponse.json({ success: true, id: String(res.insertedId), message: `Campus "${d.name}" created.` });
      }
      case "trainer": {
        const d = parsed.data as z.infer<(typeof schemas)["trainer"]>;
        const res = await db.collection("trainers").insertOne({
          en: { trainer_name: d.name }, ur: { trainer_name: d.name }, email: d.email,
          campus: [oid(d.campus_id)], hourly_rate: d.salary, createdAt: new Date(),
        });
        return NextResponse.json({ success: true, id: String(res.insertedId), message: `Trainer "${d.name}" added.` });
      }
      case "course": {
        const d = parsed.data as z.infer<(typeof schemas)["course"]>;
        const cat = await db.collection("courses").insertOne({
          en: { course_name: d.name }, ur: { course_name: d.name }, createdAt: new Date(),
        });
        const res = await db.collection("new_courses").insertOne({
          course: cat.insertedId, campuses: [oid(d.campus_id)], batch_number: 1,
          status: d.status !== "completed", createdAt: new Date(),
        });
        return NextResponse.json({ success: true, id: String(res.insertedId), message: `Course "${d.name}" created.` });
      }
      case "student": {
        const d = parsed.data as z.infer<(typeof schemas)["student"]>;
        const nc = await db.collection("new_courses").findOne({ _id: oid(d.course_id) as ObjectId });
        const studentId = new ObjectId();
        await db.collection("students").insertOne({
          _id: studentId, full_name: d.name, email: d.email, contact_number: d.phone, createdAt: new Date(),
        });
        const ind = await db.collection("student_inductions").insertOne({
          student_id: studentId, campus: oid(d.campus_id), course: nc?.course ?? null,
          new_course: oid(d.course_id), trainer: oid(d.trainer_id),
          status: d.enrollment_status === "active" ? "enrolled" : "completed", createdAt: new Date(),
        });
        return NextResponse.json({ success: true, id: String(ind.insertedId), message: `Student "${d.name}" enrolled.` });
      }
      case "active_class": {
        const d = parsed.data as z.infer<(typeof schemas)["active_class"]>;
        const res = await db.collection("slots").insertOne({
          campus: oid(d.campus_id), trainer: oid(d.trainer_id), new_course: oid(d.course_id),
          schedule: d.timing, capacity: d.student_count, booked: d.student_count,
          status: "active", createdAt: new Date(),
        });
        return NextResponse.json({ success: true, id: String(res.insertedId), message: `Class "${d.name}" scheduled.` });
      }
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
