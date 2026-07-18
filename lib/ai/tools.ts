/**
 * Tool layer for the AI agent — reads AND writes against the live database.
 *
 * Role scoping happens HERE, server-side:
 * - Trainers only ever see their own students/courses/classes/placements.
 * - Write tools (create_x / record_x) are ADMIN ONLY.
 */
import type { AgentContext } from "@/lib/ai/context";
import {
  getCampuses,
  getCourses,
  getOrgStats,
  getTrainer,
  getTrainers,
  resolveNames,
  searchActiveClasses,
  searchCampuses,
  searchCourses,
  searchStudents,
  searchTrainers,
} from "@/lib/management-api";
import { buildWordReport, uploadWordReport } from "@/lib/ai/report";
import { mongo } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/** String id → ObjectId when it looks like one, else the raw string. */
const oid = (id: string): ObjectId | string => (/^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : id);
/** Match a stored id that may be an ObjectId or a string. */
const idEq = (id: string) => (/^[a-f0-9]{24}$/i.test(id) ? { $in: [new ObjectId(id), id] } : id);
const rx = (q: string) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Map our derived enrollment status back to a real induction status value. */
const statusFromEnrollment = (v: string) => (v === "active" ? "enrolled" : "completed");

export const toolDefinitions = [
  /* ── read tools ─────────────────────────────────────────── */
  {
    type: "function" as const,
    function: {
      name: "get_org_stats",
      description:
        "Organization-wide totals: campuses, students, trainers, running courses, active classes. Placements, average salary, average progress, and average attendance are NOT tracked in the database — this tool does not return them and you must never estimate them.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_campuses",
      description:
        "All Saylani campuses with city and their student, trainer, and course counts.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_students",
      description:
        "Student profiles with campus, course, trainer, and enrollment status. Trainers automatically see only their own students. Course progress, attendance %, and job placement are NOT tracked per student — this tool cannot return them and you must not estimate them.",
      parameters: {
        type: "object",
        properties: {
          campus: { type: "string", description: "Filter to one campus — name (e.g. 'Bahdurabad') or id. Use list_campuses first if unsure of the exact name." },
          course: { type: "string", description: "Filter to one course — name (e.g. 'Web & Mobile App Development') or id. Use list_courses first if unsure of the exact name." },
          enrollment_status: { type: "string", enum: ["active", "inactive"] },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_trainers",
      description:
        "All trainers with campus, specialization, hourly rate, active students, and batches taught. (Trainers get only their own profile.) Placement counts and performance scores are NOT tracked — never invent them.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_courses",
      description: "Courses with campus, trainer, status, enrollment, and duration. Trainers see only their own. Course completion progress is NOT tracked — never estimate it.",
      parameters: {
        type: "object",
        properties: { status: { type: "string", enum: ["running", "completed", "upcoming"] } },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_active_classes",
      description: "Currently running class sections with campus, trainer, course, student count, timings.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_placed_students",
      description: "Students who secured jobs: company, monthly salary (PKR), date, campus, course, trainer. Trainers see only their own.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_word_report",
      description:
        "Generate a downloadable Word (.docx) document and return a download link. Use this whenever the user asks for a document, file, export, printable report, or says things like 'give me a word file', 'bana ke do', 'ek document banao', 'export this'. ALWAYS call your list_* / get_org_stats tools FIRST to fetch the real data, then pass the exact rows here — never invent rows. Keep columns short and focused on what was asked (e.g. Name, Roll No / Email, Age, Campus).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Report title, e.g. 'Gulshan Campus — Web Development Students'" },
          intro: { type: "string", description: "Optional 1–2 sentence summary of what this report covers" },
          columns: {
            type: "array",
            items: { type: "string" },
            description: "Column headers in order, e.g. ['Name','Email','Campus','Course']",
          },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
            description: "Each entry is one row: an array of cell values in the SAME order as columns.",
          },
        },
        required: ["title", "columns", "rows"],
      },
    },
  },

  /* ── write tools (ADMIN ONLY) ───────────────────────────── */
  {
    type: "function" as const,
    function: {
      name: "create_student",
      description:
        "ADMIN ONLY: enroll a new student into the database. campus/course/trainer accept a name (e.g. 'Gulshan Head Campus', 'Kashif Mehmood') or an id.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          campus: { type: "string", description: "Campus name or id" },
          course: { type: "string", description: "Course name or id" },
          trainer: { type: "string", description: "Trainer name or id" },
        },
        required: ["name", "email", "campus", "course", "trainer"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_campus",
      description: "ADMIN ONLY: add a new campus.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          city: { type: "string" },
          address: { type: "string" },
          established: { type: "string", description: "Year, e.g. '2026'" },
        },
        required: ["name", "city", "address"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_trainer",
      description: "ADMIN ONLY: add a new trainer. campus accepts a name or id. Trainers are paid hourly, not monthly.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          campus: { type: "string" },
          specialization: { type: "string" },
          hourly_rate_pkr: { type: "number" },
        },
        required: ["name", "email", "campus", "specialization", "hourly_rate_pkr"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_course",
      description: "ADMIN ONLY: add a new course. campus/trainer accept names or ids.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          campus: { type: "string" },
          trainer: { type: "string" },
          status: { type: "string", enum: ["running", "completed", "upcoming"] },
          duration_months: { type: "number" },
          started_at: { type: "string", description: "Date YYYY-MM-DD" },
        },
        required: ["name", "campus", "trainer", "duration_months", "started_at"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_active_class",
      description: "ADMIN ONLY: add a live class section. campus/trainer/course accept names or ids.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          campus: { type: "string" },
          trainer: { type: "string" },
          course: { type: "string" },
          student_count: { type: "number" },
          timing: { type: "string", description: "e.g. 'Mon–Fri · 9:00–11:00 AM'" },
        },
        required: ["name", "campus", "trainer", "course", "timing"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_record",
      description:
        "ADMIN ONLY: edit an EXISTING record. Pick the entity type, identify the row (student: prefer email or id — names collide; trainer/course/campus/active_class: name or id works), and pass only the fields you want to change. Unknown/omitted fields are left untouched. Call the matching list_* tool first if you're not sure the identifier is unique.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["student", "trainer", "course", "campus", "active_class"],
          },
          identifier: { type: "string", description: "Name, email, or id of the record to update" },
          fields: {
            type: "object",
            description:
              "Only the fields to change, e.g. {\"email\": \"ali@example.com\", \"campus\": \"Bahdurabad\"} for a student, or {\"hourly_rate_pkr\": 1200} for a trainer. Field names match the create_* tool argument names for that entity (campus/course/trainer values are names, resolved automatically).",
            additionalProperties: true,
          },
        },
        required: ["entity", "identifier", "fields"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_record",
      description:
        "ADMIN ONLY: permanently delete a record. Confirm with the admin before calling this (e.g. \"Delete Ali Khan's student record — are you sure?\") unless they already said something unambiguous like \"yes delete it\". Deleting a campus/trainer/course that still has students attached is refused — remove or reassign those first.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["student", "trainer", "course", "campus", "active_class"],
          },
          identifier: { type: "string", description: "Name, email, or id of the record to delete" },
        },
        required: ["entity", "identifier"],
      },
    },
  },
];

/* ── helpers ─────────────────────────────────────────────── */

/** Lowercase + strip punctuation → word tokens ("Gulshan Head Campus" → ["gulshan","head","campus"]). */
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** id prefixes used by `npm run load:seed*` — synthetic scale-testing rows
 *  (e.g. "Web Development — Batch 24" with 0 real students) that can
 *  textually out-match a real, populated record. Never natural-language
 *  addressable — excluded from fuzzy name resolution. */
const isLoadTestId = (id: string) => /^(ls|lco|lcp|lt|lac|lc|ldn)-/.test(id);

/**
 * Forgiving name lookup: exact id → exact name → substring → token overlap.
 * Users type "gulshan campus" for "Gulshan Head Campus", "kashif" for
 * "Kashif Mehmood", etc. — the row whose name shares the most words with the
 * query wins (generic filler words alone are not enough to match).
 */
function matchByName<T extends { id: string; name?: string; title?: string }>(
  allRows: T[],
  needle: string,
): T | undefined {
  const realRows = allRows.filter((r) => !isLoadTestId(r.id));
  const rows = realRows.length > 0 ? realRows : allRows;
  const q = needle.trim().toLowerCase();
  const label = (r: T) => (r.name ?? r.title ?? "").toLowerCase();

  const direct =
    rows.find((r) => r.id.toLowerCase() === q) ??
    rows.find((r) => label(r) === q) ??
    rows.find((r) => label(r).includes(q));
  if (direct) return direct;

  // Words like "campus"/"course" appear in every row's name — they must not
  // decide a match on their own.
  const GENERIC = new Set(["campus", "campuses", "course", "class", "the", "of", "and"]);
  const qTokens = tokens(q);
  const meaningful = qTokens.filter((t) => !GENERIC.has(t));
  if (meaningful.length === 0) return undefined;

  let best: T | undefined;
  let bestScore = 0;
  for (const row of rows) {
    const rowTokens = new Set(tokens(label(row)));
    const hits = meaningful.filter((t) => rowTokens.has(t)).length;
    if (hits === 0) continue;
    // All meaningful words must be present for a confident match;
    // prefer the row matching the most words overall.
    if (hits === meaningful.length) {
      const total = qTokens.filter((t) => rowTokens.has(t)).length;
      if (total > bestScore) {
        bestScore = total;
        best = row;
      }
    }
  }
  return best;
}

const err = (message: string) => JSON.stringify({ error: message });
const argStr = (args: Record<string, unknown>, key: string) => String(args[key] ?? "").trim();

interface StudentRow {
  /** The student_induction _id (our "student" row is really an enrolment). */
  id: string;
  studentId: string;
  name: string;
  email: string;
  campus_id: string;
  course_id: string;
  trainer_id: string;
}

/** Finds one enrolment (student_induction ⋈ student) by induction/student id,
 *  email (exact), or name (fuzzy, ambiguity-checked). Never scans the whole
 *  collection. */
async function findStudent(
  identifier: string,
): Promise<{ row: StudentRow } | { error: string }> {
  const q = identifier.trim();
  const db = await mongo();
  const or: Record<string, unknown>[] = [];
  if (/^[a-f0-9]{24}$/i.test(q)) {
    or.push({ _id: new ObjectId(q) }, { student_id: new ObjectId(q) });
  }
  or.push({ "stu.email": { $regex: `^${rx(q)}$`, $options: "i" } });
  or.push({ "stu.full_name": { $regex: rx(q), $options: "i" } });

  const rows = await db.collection("student_inductions").aggregate([
    { $lookup: { from: "students", localField: "student_id", foreignField: "_id", as: "stu" } },
    { $unwind: "$stu" },
    { $match: { $or: or } },
    { $limit: 5 },
    { $project: { campus: 1, course: 1, trainer: 1, "stu._id": 1, "stu.full_name": 1, "stu.email": 1 } },
  ]).toArray();

  if (rows.length === 0) {
    return { error: `Student not found: "${identifier}". Try their email or use list_students to search.` };
  }
  if (rows.length > 1) {
    const options = rows.map((s) => `${s.stu.full_name} (${s.stu.email})`).join(", ");
    return { error: `Multiple students match "${identifier}": ${options}. Use their email to pick one.` };
  }
  const r = rows[0];
  return {
    row: {
      id: String(r._id),
      studentId: String(r.stu._id),
      name: String(r.stu.full_name ?? ""),
      email: String(r.stu.email ?? ""),
      campus_id: r.campus ? String(r.campus) : "",
      course_id: r.course ? String(r.course) : "",
      trainer_id: r.trainer ? String(r.trainer) : "",
    },
  };
}

/** Execute a tool call with role-based scoping. Returns a JSON string. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<string> {
  const trainer = ctx.role === "trainer" ? await getTrainer(ctx.userEmail) : null;

  // A trainer whose own record can't be resolved must NOT fall through to the
  // list tools — there, `trainerId: trainer?.id` becomes undefined, the filter
  // drops, and they'd see the whole organization's students/courses/classes.
  // Refuse instead.
  if (ctx.role === "trainer" && !trainer) {
    return err(
      "I couldn't find your trainer profile, so I can't safely load your data. Please contact an admin to check your account.",
    );
  }

  const db = await mongo();

  /* Writes are admin-only. */
  if (
    name.startsWith("create_") ||
    name.startsWith("record_") ||
    name.startsWith("update_") ||
    name.startsWith("delete_")
  ) {
    if (ctx.role !== "admin") {
      return err("Permission denied: only admins can add or modify data.");
    }
  }

  switch (name) {
    /* ── reads ──────────────────────────────────────────── */
    case "get_org_stats": {
      // Only the counts that are genuinely backed by the database. OrgStats
      // still carries placement/progress/attendance fields that are hardcoded
      // zeros; handing those to the model made it report "0% placement rate
      // across all campuses" as if it were a measured fact.
      const st = await getOrgStats();
      return JSON.stringify({
        total_campuses: st.totalCampuses,
        total_students: st.totalStudents,
        total_trainers: st.totalTrainers,
        running_courses: st.runningCourses,
        active_classes: st.activeClasses,
      });
    }

    case "list_campuses": {
      // Server-side pagination — never pulls the whole (potentially huge) table.
      const { campuses, total } = await searchCampuses({ pageSize: 40 });
      const rows = campuses.map((c) => ({
        name: c.name,
        city: c.city,
        students: c.studentCount,
        trainers: c.trainerCount,
        courses: c.courseCount,
      }));
      if (total <= rows.length) return JSON.stringify(rows);
      return JSON.stringify({
        total_matching: total,
        showing_first: rows.length,
        note: `Sample of ${rows.length} out of ${total.toLocaleString()} campuses — use get_org_stats for org-wide totals.`,
        rows,
      });
    }

    case "list_students": {
      let campusId: string | undefined;
      if (typeof args.campus === "string" && args.campus.trim()) {
        const campus = matchByName(await getCampuses(), args.campus);
        if (!campus) return err(`Campus not found: "${args.campus}". Use list_campuses to see options.`);
        campusId = campus.id;
      }
      let courseId: string | undefined;
      if (typeof args.course === "string" && args.course.trim()) {
        // No DB-side text filter here — matchByName's fuzzy token matching
        // needs to see full course names (e.g. "Web Development" must still
        // match "Web & Mobile App Development"), which a strict ILIKE would
        // exclude before matching even runs.
        const candidates = campusId
          ? (await searchCourses({ campusId, pageSize: 50 })).courses
          : await getCourses();
        const course = matchByName(candidates, args.course);
        if (!course) return err(`Course not found: "${args.course}". Use list_courses to see options.`);
        courseId = course.id;
      }

      // Server-side filtered search with a TRUE total — scales to millions of rows.
      const { students, total } = await searchStudents({
        trainerId: trainer?.id,
        campusId,
        courseId,
        enrollmentStatus: typeof args.enrollment_status === "string" ? args.enrollment_status : undefined,
        pageSize: 40,
      });
      const [campusName, courseName, trainerName] = await Promise.all([
        resolveNames("campuses", students.map((s) => s.campusId)),
        resolveNames("courses", students.map((s) => s.courseId)),
        resolveNames("trainers", students.map((s) => s.trainerId)),
      ]);
      const rows = students.map((s) => ({
        name: s.name,
        email: s.email,
        phone: s.phone,
        campus: campusName[s.campusId] ?? s.campusId,
        course: courseName[s.courseId] ?? s.courseId,
        trainer: trainerName[s.trainerId] ?? s.trainerId,
        enrollment_status: s.enrollmentStatus,
      }));
      if (total <= rows.length) return JSON.stringify(rows);
      return JSON.stringify({
        total_matching: total,
        showing_first: rows.length,
        note: `Sample of ${rows.length} out of ${total.toLocaleString()} matching students — use get_org_stats for org-wide totals/averages.`,
        rows,
      });
    }

    case "list_trainers": {
      const { trainers, total } = trainer
        ? { trainers: [trainer], total: 1 }
        : await searchTrainers({ pageSize: 40 });
      const campusName = await resolveNames("campuses", trainers.map((t) => t.campusId));
      const rows = trainers.map((t) => ({
        name: t.name,
        campus: campusName[t.campusId] ?? t.campusId,
        specialization: t.specialization,
        hourly_rate_pkr: t.salary,
        active_students: t.studentCount,
        batches_taught: t.batchesCount,
        joined: t.joinedAt,
      }));
      if (total <= rows.length) return JSON.stringify(rows);
      return JSON.stringify({
        total_matching: total,
        showing_first: rows.length,
        note: `Sample of ${rows.length} out of ${total.toLocaleString()} trainers.`,
        rows,
      });
    }

    case "list_courses": {
      const { courses, total } = await searchCourses({
        trainerId: trainer?.id,
        status: typeof args.status === "string" ? args.status : undefined,
        pageSize: 40,
      });
      const [campusName, trainerName] = await Promise.all([
        resolveNames("campuses", courses.map((c) => c.campusId)),
        resolveNames("trainers", courses.map((c) => c.trainerId)),
      ]);
      const rows = courses.map((c) => ({
        name: c.name,
        campus: campusName[c.campusId] ?? c.campusId,
        trainer: trainerName[c.trainerId] ?? c.trainerId,
        status: c.status,
        enrolled: c.enrolledCount,
        duration_months: c.durationMonths,
        started: c.startedAt,
      }));
      if (total <= rows.length) return JSON.stringify(rows);
      return JSON.stringify({
        total_matching: total,
        showing_first: rows.length,
        note: `Sample of ${rows.length} out of ${total.toLocaleString()} courses.`,
        rows,
      });
    }

    case "list_active_classes": {
      const { classes, total } = await searchActiveClasses({ trainerId: trainer?.id, pageSize: 40 });
      const [campusName, trainerName, courseName] = await Promise.all([
        resolveNames("campuses", classes.map((c) => c.campusId)),
        resolveNames("trainers", classes.map((c) => c.trainerId)),
        resolveNames("courses", classes.map((c) => c.courseId)),
      ]);
      const rows = classes.map((c) => ({
        name: c.name,
        campus: campusName[c.campusId] ?? c.campusId,
        trainer: trainerName[c.trainerId] ?? c.trainerId,
        course: courseName[c.courseId] ?? c.courseId,
        students: c.studentCount,
        timing: c.timing,
      }));
      if (total <= rows.length) return JSON.stringify(rows);
      return JSON.stringify({
        total_matching: total,
        showing_first: rows.length,
        note: `Sample of ${rows.length} out of ${total.toLocaleString()} active classes.`,
        rows,
      });
    }

    case "list_placed_students": {
      const { students: placed, total } = await searchStudents({
        trainerId: trainer?.id,
        placementStatus: "placed",
        pageSize: 40,
      });
      const [campusName, courseName, trainerName] = await Promise.all([
        resolveNames("campuses", placed.map((s) => s.campusId)),
        resolveNames("courses", placed.map((s) => s.courseId)),
        resolveNames("trainers", placed.map((s) => s.trainerId)),
      ]);
      const rows = placed.map((s) => ({
        name: s.name,
        campus: campusName[s.campusId] ?? s.campusId,
        course: courseName[s.courseId] ?? s.courseId,
        trainer: trainerName[s.trainerId] ?? s.trainerId,
        company: s.company,
        monthly_salary_pkr: s.salary,
        placement_date: s.placementDate,
      }));
      if (rows.length === 0) {
        return JSON.stringify({
          rows: [],
          note: "Job placements are not tracked in the training system's database yet, so there is no placement data to report. Do not estimate or invent placement figures.",
        });
      }
      if (total <= rows.length) return JSON.stringify(rows);
      return JSON.stringify({
        total_matching: total,
        showing_first: rows.length,
        note: `Sample of ${rows.length} out of ${total.toLocaleString()} placed students.`,
        rows,
      });
    }

    case "generate_word_report": {
      const title = argStr(args, "title") || "Report";
      const intro = argStr(args, "intro") || undefined;
      const columns = Array.isArray(args.columns) ? args.columns.map(String) : [];
      const rowsIn = Array.isArray(args.rows) ? (args.rows as unknown[]) : [];
      if (columns.length === 0) return err("columns[] is required — at least one column header.");
      if (rowsIn.length === 0) return err("rows[] is empty — fetch the data with a list_* tool first.");
      const MAX_ROWS = 2000;
      const rows = rowsIn.slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r.map(String) : [String(r)]));

      try {
        const buffer = await buildWordReport({ title, intro, columns, rows, generatedFor: ctx.userName });
        const { url, filename } = await uploadWordReport(buffer, title, ctx.userId);
        return JSON.stringify({
          success: true,
          filename,
          download_url: url,
          row_count: rows.length,
          truncated: rowsIn.length > MAX_ROWS,
          message: `"${filename}" is ready (${rows.length} rows). Link expires in 24 hours.`,
        });
      } catch (e) {
        return err(`Could not generate the document: ${(e as Error).message}`);
      }
    }

    /* ── writes (admin verified above) ──────────────────── */
    case "create_campus": {
      const cityName = argStr(args, "city");
      const cityDoc = cityName
        ? await db.collection("cities").findOne({ "en.city_name": { $regex: `^${rx(cityName)}$`, $options: "i" } })
        : null;
      const res = await db.collection("campus").insertOne({
        en: { campus_name: argStr(args, "name"), address: argStr(args, "address") },
        ur: { campus_name: argStr(args, "name"), address: argStr(args, "address") },
        city: cityDoc?._id ?? null,
        createdAt: new Date(),
      });
      return JSON.stringify({ success: true, id: String(res.insertedId), message: `Campus "${args.name}" created.` });
    }

    case "create_trainer": {
      const campus = matchByName(await getCampuses(), argStr(args, "campus"));
      if (!campus) return err(`Campus not found: "${args.campus}". Use list_campuses to see options.`);
      const res = await db.collection("trainers").insertOne({
        en: { trainer_name: argStr(args, "name") },
        ur: { trainer_name: argStr(args, "name") },
        email: argStr(args, "email"),
        campus: [oid(campus.id)],
        hourly_rate: Number(args.hourly_rate_pkr ?? 0),
        createdAt: new Date(),
      });
      return JSON.stringify({ success: true, id: String(res.insertedId), message: `Trainer "${args.name}" added to ${campus.name}.` });
    }

    case "create_course": {
      const campus = matchByName(await getCampuses(), argStr(args, "campus"));
      if (!campus) return err(`Campus not found: "${args.campus}".`);
      // A "course" is an offering: create the catalog entry then a batch of it.
      const cat = await db.collection("courses").insertOne({
        en: { course_name: argStr(args, "name") },
        ur: { course_name: argStr(args, "name") },
        createdAt: new Date(),
      });
      const res = await db.collection("new_courses").insertOne({
        course: cat.insertedId,
        campuses: [oid(campus.id)],
        batch_number: 1,
        status: (argStr(args, "status") || "upcoming") !== "completed",
        createdAt: new Date(),
      });
      return JSON.stringify({ success: true, id: String(res.insertedId), message: `Course "${args.name}" created at ${campus.name}.` });
    }

    case "create_student": {
      const campus = matchByName(await getCampuses(), argStr(args, "campus"));
      if (!campus) return err(`Campus not found: "${args.campus}".`);
      const course = matchByName(await getCourses(), argStr(args, "course"));
      if (!course) return err(`Course not found: "${args.course}". Use list_courses to see options.`);
      const studentTrainer = matchByName(await getTrainers(), argStr(args, "trainer"));
      if (!studentTrainer) return err(`Trainer not found: "${args.trainer}".`);
      // course.id is a new_courses _id — resolve its catalog course for the induction.
      const nc = await db.collection("new_courses").findOne({ _id: oid(course.id) as ObjectId });
      const studentId = new ObjectId();
      await db.collection("students").insertOne({
        _id: studentId,
        full_name: argStr(args, "name"),
        email: argStr(args, "email"),
        contact_number: argStr(args, "phone"),
        createdAt: new Date(),
      });
      const ind = await db.collection("student_inductions").insertOne({
        student_id: studentId,
        campus: oid(campus.id),
        course: nc?.course ?? null,
        new_course: oid(course.id),
        trainer: oid(studentTrainer.id),
        status: "enrolled",
        createdAt: new Date(),
      });
      return JSON.stringify({
        success: true,
        id: String(ind.insertedId),
        message: `Student "${args.name}" enrolled in ${course.name} at ${campus.name} under ${studentTrainer.name}.`,
      });
    }

    case "create_active_class": {
      const campus = matchByName(await getCampuses(), argStr(args, "campus"));
      if (!campus) return err(`Campus not found: "${args.campus}".`);
      const classTrainer = matchByName(await getTrainers(), argStr(args, "trainer"));
      if (!classTrainer) return err(`Trainer not found: "${args.trainer}".`);
      const course = matchByName(await getCourses(), argStr(args, "course"));
      if (!course) return err(`Course not found: "${args.course}".`);
      const res = await db.collection("slots").insertOne({
        campus: oid(campus.id),
        trainer: oid(classTrainer.id),
        new_course: oid(course.id),
        schedule: argStr(args, "timing"),
        capacity: Number(args.student_count ?? 0),
        booked: Number(args.student_count ?? 0),
        status: "active",
        createdAt: new Date(),
      });
      return JSON.stringify({ success: true, id: String(res.insertedId), message: `Class "${args.name}" scheduled.` });
    }

    case "update_record": {
      const entity = argStr(args, "entity");
      const identifier = argStr(args, "identifier");
      const fields = (typeof args.fields === "object" && args.fields ? args.fields : {}) as Record<string, unknown>;
      if (!identifier) return err("identifier is required.");
      if (Object.keys(fields).length === 0) return err("fields is empty — nothing to update.");

      switch (entity) {
        case "student": {
          const found = await findStudent(identifier);
          if ("error" in found) return err(found.error);
          const stuPatch: Record<string, unknown> = {};
          if ("name" in fields) stuPatch.full_name = String(fields.name);
          if ("email" in fields) stuPatch.email = String(fields.email);
          if ("phone" in fields) stuPatch.contact_number = String(fields.phone);
          const indPatch: Record<string, unknown> = {};
          if ("enrollment_status" in fields) indPatch.status = statusFromEnrollment(String(fields.enrollment_status));
          if ("campus" in fields) {
            const campus = matchByName(await getCampuses(), String(fields.campus));
            if (!campus) return err(`Campus not found: "${fields.campus}".`);
            indPatch.campus = oid(campus.id);
          }
          if ("course" in fields) {
            const course = matchByName(await getCourses(), String(fields.course));
            if (!course) return err(`Course not found: "${fields.course}".`);
            const nc = await db.collection("new_courses").findOne({ _id: oid(course.id) as ObjectId });
            indPatch.new_course = oid(course.id);
            indPatch.course = nc?.course ?? null;
          }
          if ("trainer" in fields) {
            const studentTrainer = matchByName(await getTrainers(), String(fields.trainer));
            if (!studentTrainer) return err(`Trainer not found: "${fields.trainer}".`);
            indPatch.trainer = oid(studentTrainer.id);
          }
          if (Object.keys(stuPatch).length)
            await db.collection("students").updateOne({ _id: new ObjectId(found.row.studentId) }, { $set: stuPatch });
          if (Object.keys(indPatch).length)
            await db.collection("student_inductions").updateOne({ _id: new ObjectId(found.row.id) }, { $set: indPatch });
          return JSON.stringify({ success: true, id: found.row.id, message: `Updated ${found.row.name}.` });
        }

        case "trainer": {
          const t = matchByName(await getTrainers(), identifier);
          if (!t) return err(`Trainer not found: "${identifier}". Use list_trainers to see options.`);
          const patch: Record<string, unknown> = {};
          if ("name" in fields) patch["en.trainer_name"] = String(fields.name);
          if ("email" in fields) patch.email = String(fields.email);
          if ("hourly_rate_pkr" in fields) patch.hourly_rate = Number(fields.hourly_rate_pkr);
          if ("campus" in fields) {
            const campus = matchByName(await getCampuses(), String(fields.campus));
            if (!campus) return err(`Campus not found: "${fields.campus}".`);
            patch.campus = [oid(campus.id)];
          }
          await db.collection("trainers").updateOne({ _id: oid(t.id) as ObjectId }, { $set: patch });
          return JSON.stringify({ success: true, id: t.id, message: `Updated ${t.name}.` });
        }

        case "course": {
          const c = matchByName(await getCourses(), identifier);
          if (!c) return err(`Course not found: "${identifier}". Use list_courses to see options.`);
          if ("name" in fields) {
            const nc = await db.collection("new_courses").findOne({ _id: oid(c.id) as ObjectId });
            if (nc?.course)
              await db.collection("courses").updateOne({ _id: nc.course }, { $set: { "en.course_name": String(fields.name) } });
          }
          if ("status" in fields)
            await db.collection("new_courses").updateOne({ _id: oid(c.id) as ObjectId }, { $set: { status: String(fields.status) !== "completed" } });
          return JSON.stringify({ success: true, id: c.id, message: `Updated ${c.name}.` });
        }

        case "campus": {
          const c = matchByName(await getCampuses(), identifier);
          if (!c) return err(`Campus not found: "${identifier}". Use list_campuses to see options.`);
          const patch: Record<string, unknown> = {};
          if ("name" in fields) patch["en.campus_name"] = String(fields.name);
          if ("address" in fields) patch["en.address"] = String(fields.address);
          if ("city" in fields) {
            const cityDoc = await db.collection("cities").findOne({ "en.city_name": { $regex: `^${rx(String(fields.city))}$`, $options: "i" } });
            if (cityDoc) patch.city = cityDoc._id;
          }
          await db.collection("campus").updateOne({ _id: oid(c.id) as ObjectId }, { $set: patch });
          return JSON.stringify({ success: true, id: c.id, message: `Updated ${c.name}.` });
        }

        case "active_class": {
          const { classes } = await searchActiveClasses({ pageSize: 50, query: identifier });
          const cls = matchByName(classes, identifier);
          if (!cls) return err(`Active class not found: "${identifier}". Use list_active_classes to see options.`);
          const patch: Record<string, unknown> = {};
          if ("student_count" in fields) patch.booked = Number(fields.student_count);
          if ("timing" in fields) patch.schedule = String(fields.timing);
          if ("campus" in fields) {
            const campus = matchByName(await getCampuses(), String(fields.campus));
            if (!campus) return err(`Campus not found: "${fields.campus}".`);
            patch.campus = oid(campus.id);
          }
          if ("trainer" in fields) {
            const classTrainer = matchByName(await getTrainers(), String(fields.trainer));
            if (!classTrainer) return err(`Trainer not found: "${fields.trainer}".`);
            patch.trainer = oid(classTrainer.id);
          }
          await db.collection("slots").updateOne({ _id: oid(cls.id) as ObjectId }, { $set: patch });
          return JSON.stringify({ success: true, id: cls.id, message: `Updated class "${cls.name}".` });
        }

        default:
          return err(`Unknown entity: "${entity}". Must be one of student, trainer, course, campus, active_class.`);
      }
    }

    case "delete_record": {
      const entity = argStr(args, "entity");
      const identifier = argStr(args, "identifier");
      if (!identifier) return err("identifier is required.");

      switch (entity) {
        case "student": {
          const found = await findStudent(identifier);
          if ("error" in found) return err(found.error);
          const studentObjectId = new ObjectId(found.row.studentId);
          const inductionObjectId = new ObjectId(found.row.id);
          const otherInductions = await db.collection("student_inductions").countDocuments({
            student_id: studentObjectId,
            _id: { $ne: inductionObjectId },
          });
          // This is the person's only enrolment, so deleting it also removes
          // their master record — same referential-integrity rule already
          // applied to trainers/courses/campuses: block if real history
          // (attendance, fee payments) would be orphaned.
          if (otherInductions === 0) {
            const [attendanceDeps, paymentDeps] = await Promise.all([
              db.collection("attendances").countDocuments({ student_id: idEq(found.row.studentId) }),
              db.collection("payments").countDocuments({ student: idEq(found.row.studentId) }),
            ]);
            if (attendanceDeps > 0 || paymentDeps > 0) {
              return err(
                `Can't delete ${found.row.name} — still linked to ${attendanceDeps} attendance records and ${paymentDeps} fee payments. Those must be resolved first.`,
              );
            }
          }
          await db.collection("student_inductions").deleteOne({ _id: inductionObjectId });
          if (otherInductions === 0) await db.collection("students").deleteOne({ _id: studentObjectId });
          return JSON.stringify({ success: true, message: `Deleted student ${found.row.name}.` });
        }

        case "trainer": {
          const t = matchByName(await getTrainers(), identifier);
          if (!t) return err(`Trainer not found: "${identifier}".`);
          const [studentDeps, classDeps] = await Promise.all([
            db.collection("student_inductions").countDocuments({ trainer: idEq(t.id) }),
            db.collection("slots").countDocuments({ trainer: idEq(t.id) }),
          ]);
          if (studentDeps > 0 || classDeps > 0) {
            return err(
              `Can't delete ${t.name} — still linked to ${studentDeps} students and ${classDeps} active classes. Reassign or delete those first.`,
            );
          }
          await db.collection("trainers").deleteOne({ _id: oid(t.id) as ObjectId });
          return JSON.stringify({ success: true, message: `Deleted trainer ${t.name}.` });
        }

        case "course": {
          const c = matchByName(await getCourses(), identifier);
          if (!c) return err(`Course not found: "${identifier}".`);
          const [studentDeps, classDeps] = await Promise.all([
            db.collection("student_inductions").countDocuments({ new_course: idEq(c.id) }),
            db.collection("slots").countDocuments({ new_course: idEq(c.id) }),
          ]);
          if (studentDeps > 0 || classDeps > 0) {
            return err(
              `Can't delete "${c.name}" — still linked to ${studentDeps} students and ${classDeps} active classes. Reassign or delete those first.`,
            );
          }
          await db.collection("new_courses").deleteOne({ _id: oid(c.id) as ObjectId });
          return JSON.stringify({ success: true, message: `Deleted course "${c.name}".` });
        }

        case "campus": {
          const c = matchByName(await getCampuses(), identifier);
          if (!c) return err(`Campus not found: "${identifier}".`);
          const [studentDeps, trainerDeps, classDeps] = await Promise.all([
            db.collection("student_inductions").countDocuments({ campus: idEq(c.id) }),
            db.collection("trainers").countDocuments({ campus: idEq(c.id) }),
            db.collection("slots").countDocuments({ campus: idEq(c.id) }),
          ]);
          if (studentDeps > 0 || trainerDeps > 0 || classDeps > 0) {
            return err(
              `Can't delete "${c.name}" — still linked to ${studentDeps} students, ${trainerDeps} trainers, and ${classDeps} active classes. Reassign or delete those first.`,
            );
          }
          await db.collection("campus").deleteOne({ _id: oid(c.id) as ObjectId });
          return JSON.stringify({ success: true, message: `Deleted campus "${c.name}".` });
        }

        case "active_class": {
          const { classes } = await searchActiveClasses({ pageSize: 50, query: identifier });
          const cls = matchByName(classes, identifier);
          if (!cls) return err(`Active class not found: "${identifier}".`);
          const [studentDeps, attendanceDeps] = await Promise.all([
            db.collection("student_inductions").countDocuments({ slot: idEq(cls.id) }),
            db.collection("attendances").countDocuments({ slot: idEq(cls.id) }),
          ]);
          if (studentDeps > 0 || attendanceDeps > 0) {
            return err(
              `Can't delete "${cls.name}" — still linked to ${studentDeps} students and ${attendanceDeps} attendance records. Reassign or delete those first.`,
            );
          }
          await db.collection("slots").deleteOne({ _id: oid(cls.id) as ObjectId });
          return JSON.stringify({ success: true, message: `Deleted class "${cls.name}".` });
        }

        default:
          return err(`Unknown entity: "${entity}". Must be one of student, trainer, course, campus, active_class.`);
      }
    }

    default:
      return err(`Unknown tool: ${name}`);
  }
}
