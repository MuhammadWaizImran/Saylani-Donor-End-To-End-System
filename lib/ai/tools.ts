/**
 * Tool layer for the AI agent — reads AND writes against the live database.
 *
 * Role scoping happens HERE, server-side:
 * - Trainers only ever see their own students/courses/classes/placements.
 * - Write tools (create_x / record_x) are ADMIN ONLY.
 */
import type { AgentContext } from "@/lib/ai/mock-brain";
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
import { supabaseServer } from "@/lib/supabase";

const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const toolDefinitions = [
  /* ── read tools ─────────────────────────────────────────── */
  {
    type: "function" as const,
    function: {
      name: "get_org_stats",
      description:
        "Organization-wide totals: campuses, students, trainers, running courses, active classes, placements, average salary/progress/attendance.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_campuses",
      description:
        "All Saylani campuses with city, student/trainer/course counts, placement rate, and overall progress percent.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_students",
      description:
        "Student profiles with campus, course, trainer, enrollment status, progress %, attendance %, and placement info. Trainers automatically see only their own students.",
      parameters: {
        type: "object",
        properties: {
          campus: { type: "string", description: "Filter to one campus — name (e.g. 'Gulshan Head Campus') or id. Use list_campuses first if unsure of the exact name." },
          course: { type: "string", description: "Filter to one course — name (e.g. 'Web & Mobile App Development') or id. Use list_courses first if unsure of the exact name." },
          enrollment_status: { type: "string", enum: ["active", "inactive"] },
          placement_status: { type: "string", enum: ["placed", "seeking", "studying"] },
          max_attendance_percent: { type: "number", description: "Only students at or below this attendance (at-risk queries)" },
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
        "All trainers with campus, specialization, salary, students, batches, placements, performance. (Trainers get only their own profile.)",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_courses",
      description: "Courses with campus, trainer, status, enrollment, duration, progress. Trainers see only their own.",
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
      description: "ADMIN ONLY: add a new trainer. campus accepts a name or id.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          campus: { type: "string" },
          specialization: { type: "string" },
          monthly_salary_pkr: { type: "number" },
        },
        required: ["name", "email", "campus", "specialization", "monthly_salary_pkr"],
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
      name: "create_campaign",
      description: "ADMIN ONLY: add a new donation campaign to the public website.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          tagline: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: ["Education", "Healthcare", "Food Relief", "Clean Water", "Emergency", "Orphan Care"] },
          location: { type: "string" },
          goal_amount_pkr: { type: "number" },
          status: { type: "string", enum: ["active", "urgent"] },
          ends_at: { type: "string", description: "Date YYYY-MM-DD" },
        },
        required: ["title", "tagline", "description", "category", "location", "goal_amount_pkr", "ends_at"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_donation",
      description:
        "ADMIN ONLY: record a donation (e.g. received via bank/cash) against a campaign. Also updates the campaign's raised amount. campaign accepts a title or id.",
      parameters: {
        type: "object",
        properties: {
          campaign: { type: "string", description: "Campaign title or id" },
          donor_name: { type: "string" },
          amount_pkr: { type: "number" },
          method: { type: "string", enum: ["JazzCash", "Easypaisa", "Bank Transfer", "Card", "Cash"] },
          is_anonymous: { type: "boolean" },
          message: { type: "string" },
        },
        required: ["campaign", "donor_name", "amount_pkr"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_record",
      description:
        "ADMIN ONLY: edit an EXISTING record. Pick the entity type, identify the row (student/donation: prefer email or id — names collide; trainer/course/campus/active_class/campaign: name or id works), and pass only the fields you want to change. Unknown/omitted fields are left untouched. Call the matching list_* tool first if you're not sure the identifier is unique.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["student", "trainer", "course", "campus", "active_class", "campaign", "donation"],
          },
          identifier: { type: "string", description: "Name, email, or id of the record to update" },
          fields: {
            type: "object",
            description:
              "Only the fields to change, e.g. {\"progress_percent\": 80, \"placement_status\": \"placed\"} for a student, or {\"salary\": 190000} for a trainer. Field names match the create_* tool argument names for that entity (campus/course/trainer/trainer values are names, resolved automatically).",
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
        "ADMIN ONLY: permanently delete a record. Confirm with the admin before calling this (e.g. \"Delete Ali Khan's student record — are you sure?\") unless they already said something unambiguous like \"yes delete it\". Deleting a campus/trainer/course/campaign that still has students/donations attached is refused — remove or reassign those first.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["student", "trainer", "course", "campus", "active_class", "campaign", "donation"],
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
  const GENERIC = new Set(["campus", "campuses", "course", "class", "campaign", "the", "of", "and"]);
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
  id: string;
  name: string;
  email: string;
  campus_id: string;
  course_id: string;
  trainer_id: string;
}

/** Finds one student by id/email (exact, indexed — works at any table size)
 *  or falls back to a bounded, ambiguity-checked name search. Never fetches
 *  the whole students table. */
async function findStudent(
  identifier: string,
): Promise<{ row: StudentRow } | { error: string }> {
  const q = identifier.trim();
  const db = supabaseServer();
  const safe = q.replace(/[%,()]/g, " ").trim();

  const { data: exact, error: exactErr } = await db
    .from("students")
    .select("id,name,email,campus_id,course_id,trainer_id")
    .or(`id.eq.${safe},email.eq.${safe}`)
    .limit(1);
  if (exactErr) return { error: exactErr.message };
  if (exact?.[0]) return { row: exact[0] as StudentRow };

  const { data: byName, error: nameErr } = await db
    .from("students")
    .select("id,name,email,campus_id,course_id,trainer_id")
    .ilike("name", `%${safe}%`)
    .limit(5);
  if (nameErr) return { error: nameErr.message };
  if (!byName || byName.length === 0) {
    return { error: `Student not found: "${identifier}". Try their email or use list_students to search.` };
  }
  if (byName.length > 1) {
    const options = byName.map((s) => `${s.name} (${s.email})`).join(", ");
    return { error: `Multiple students match "${identifier}": ${options}. Use their email to pick one.` };
  }
  return { row: byName[0] as StudentRow };
}

/** Execute a tool call with role-based scoping. Returns a JSON string. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<string> {
  const trainer = ctx.role === "trainer" ? await getTrainer(ctx.userEmail) : null;
  const db = supabaseServer();

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
    case "get_org_stats":
      return JSON.stringify(await getOrgStats());

    case "list_campuses": {
      // Server-side pagination — never pulls the whole (potentially huge) table.
      const { campuses, total } = await searchCampuses({ pageSize: 40 });
      const rows = campuses.map((c) => ({
        name: c.name,
        city: c.city,
        students: c.studentCount,
        trainers: c.trainerCount,
        courses: c.courseCount,
        placement_rate: c.placementRate,
        progress_percent: c.progressPercent,
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
        placementStatus: typeof args.placement_status === "string" ? args.placement_status : undefined,
        maxAttendance:
          typeof args.max_attendance_percent === "number" ? args.max_attendance_percent : undefined,
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
        progress_percent: s.progressPercent,
        attendance_percent: s.attendancePercent,
        placement_status: s.placementStatus,
        company: s.company ?? null,
        monthly_salary_pkr: s.salary ?? null,
        placement_date: s.placementDate ?? null,
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
        monthly_salary_pkr: t.salary,
        active_students: t.studentCount,
        batches_taught: t.batchesCount,
        students_placed: t.placedCount,
        performance_percent: t.performancePercent,
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
        progress_percent: c.progressPercent,
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
        const { url, filename } = await uploadWordReport(buffer, title);
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
      const id = newId("cp");
      const { error } = await db.from("campuses").insert({
        id,
        name: argStr(args, "name"),
        city: argStr(args, "city"),
        address: argStr(args, "address"),
        established: argStr(args, "established") || String(new Date().getFullYear()),
      });
      if (error) return err(error.message);
      return JSON.stringify({ success: true, id, message: `Campus "${args.name}" created.` });
    }

    case "create_trainer": {
      const campus = matchByName(await getCampuses(), argStr(args, "campus"));
      if (!campus) return err(`Campus not found: "${args.campus}". Use list_campuses to see options.`);
      const id = newId("t");
      const { error } = await db.from("trainers").insert({
        id,
        name: argStr(args, "name"),
        email: argStr(args, "email"),
        campus_id: campus.id,
        salary: Number(args.monthly_salary_pkr ?? 0),
        specialization: argStr(args, "specialization"),
        joined_at: new Date().toISOString().slice(0, 10),
      });
      if (error) return err(error.message);
      await db.from("campuses").update({ trainer_count: campus.trainerCount + 1 }).eq("id", campus.id);
      return JSON.stringify({ success: true, id, message: `Trainer "${args.name}" added to ${campus.name}.` });
    }

    case "create_course": {
      const campus = matchByName(await getCampuses(), argStr(args, "campus"));
      if (!campus) return err(`Campus not found: "${args.campus}".`);
      const courseTrainer = matchByName(await getTrainers(), argStr(args, "trainer"));
      if (!courseTrainer) return err(`Trainer not found: "${args.trainer}". Use list_trainers to see options.`);
      const id = newId("co");
      const { error } = await db.from("courses").insert({
        id,
        name: argStr(args, "name"),
        campus_id: campus.id,
        trainer_id: courseTrainer.id,
        status: argStr(args, "status") || "upcoming",
        duration_months: Number(args.duration_months ?? 0),
        started_at: argStr(args, "started_at"),
      });
      if (error) return err(error.message);
      await db.from("campuses").update({ course_count: campus.courseCount + 1 }).eq("id", campus.id);
      return JSON.stringify({ success: true, id, message: `Course "${args.name}" created at ${campus.name}.` });
    }

    case "create_student": {
      const campus = matchByName(await getCampuses(), argStr(args, "campus"));
      if (!campus) return err(`Campus not found: "${args.campus}".`);
      const course = matchByName(await getCourses(), argStr(args, "course"));
      if (!course) return err(`Course not found: "${args.course}". Use list_courses to see options.`);
      const studentTrainer = matchByName(await getTrainers(), argStr(args, "trainer"));
      if (!studentTrainer) return err(`Trainer not found: "${args.trainer}".`);
      const id = newId("s");
      const { error } = await db.from("students").insert({
        id,
        name: argStr(args, "name"),
        email: argStr(args, "email"),
        phone: argStr(args, "phone"),
        campus_id: campus.id,
        course_id: course.id,
        trainer_id: studentTrainer.id,
      });
      if (error) return err(error.message);
      await Promise.all([
        db.from("campuses").update({ student_count: campus.studentCount + 1 }).eq("id", campus.id),
        db.from("courses").update({ enrolled_count: course.enrolledCount + 1 }).eq("id", course.id),
        db.from("trainers").update({ student_count: studentTrainer.studentCount + 1 }).eq("id", studentTrainer.id),
      ]);
      return JSON.stringify({
        success: true,
        id,
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
      const id = newId("ac");
      const { error } = await db.from("active_classes").insert({
        id,
        name: argStr(args, "name"),
        campus_id: campus.id,
        trainer_id: classTrainer.id,
        course_id: course.id,
        student_count: Number(args.student_count ?? 0),
        timing: argStr(args, "timing"),
      });
      if (error) return err(error.message);
      return JSON.stringify({ success: true, id, message: `Class "${args.name}" scheduled.` });
    }

    case "create_campaign": {
      const id = newId("c");
      const title = argStr(args, "title");
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || id;
      const { error } = await db.from("campaigns").insert({
        id,
        slug,
        title,
        tagline: argStr(args, "tagline"),
        description: argStr(args, "description"),
        story: [argStr(args, "description")],
        image_url: "/media/hands-giving.avif",
        gallery: ["/media/hands-giving.avif"],
        category: argStr(args, "category"),
        location: argStr(args, "location"),
        goal_amount: Number(args.goal_amount_pkr ?? 0),
        status: argStr(args, "status") || "active",
        ends_at: new Date(`${argStr(args, "ends_at")}T23:59:59Z`).toISOString(),
      });
      if (error) return err(error.message);
      return JSON.stringify({
        success: true,
        id,
        message: `Campaign "${title}" is live on the website (placeholder image assigned — admin can change it later).`,
      });
    }

    case "record_donation": {
      const { data: campaignRows, error: cErr } = await db.from("campaigns").select("*");
      if (cErr) return err(cErr.message);
      const rows = (campaignRows ?? []).map((r) => ({
        id: String(r.id),
        title: String(r.title),
        raised: Number(r.raised_amount),
        donors: Number(r.donor_count),
      }));
      const campaign = matchByName(rows, argStr(args, "campaign"));
      if (!campaign) return err(`Campaign not found: "${args.campaign}".`);
      const amount = Number(args.amount_pkr ?? 0);
      if (amount <= 0) return err("amount_pkr must be a positive number.");
      const id = newId("d");
      const { error } = await db.from("donations").insert({
        id,
        campaign_id: campaign.id,
        donor_name: Boolean(args.is_anonymous) ? "Anonymous" : argStr(args, "donor_name"),
        amount,
        is_anonymous: Boolean(args.is_anonymous),
        message: argStr(args, "message") || null,
        method: argStr(args, "method") || "Bank Transfer",
        status: "completed",
      });
      if (error) return err(error.message);
      await db
        .from("campaigns")
        .update({ raised_amount: campaign.raised + amount, donor_count: campaign.donors + 1 })
        .eq("id", campaign.id);
      return JSON.stringify({
        success: true,
        id,
        message: `Donation of Rs. ${amount.toLocaleString()} recorded against "${campaign.title}". Raised total updated.`,
      });
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
          const patch: Record<string, unknown> = {};
          if ("name" in fields) patch.name = String(fields.name);
          if ("email" in fields) patch.email = String(fields.email);
          if ("phone" in fields) patch.phone = String(fields.phone);
          if ("enrollment_status" in fields) patch.enrollment_status = String(fields.enrollment_status);
          if ("progress_percent" in fields) patch.progress_percent = Number(fields.progress_percent);
          if ("attendance_percent" in fields) patch.attendance_percent = Number(fields.attendance_percent);
          if ("placement_status" in fields) patch.placement_status = String(fields.placement_status);
          if ("company" in fields) patch.company = String(fields.company);
          if ("monthly_salary_pkr" in fields) patch.salary = Number(fields.monthly_salary_pkr);
          if ("placement_date" in fields) patch.placement_date = String(fields.placement_date);
          if ("campus" in fields) {
            const campus = matchByName(await getCampuses(), String(fields.campus));
            if (!campus) return err(`Campus not found: "${fields.campus}".`);
            patch.campus_id = campus.id;
          }
          if ("course" in fields) {
            const course = matchByName(await getCourses(), String(fields.course));
            if (!course) return err(`Course not found: "${fields.course}".`);
            patch.course_id = course.id;
          }
          if ("trainer" in fields) {
            const studentTrainer = matchByName(await getTrainers(), String(fields.trainer));
            if (!studentTrainer) return err(`Trainer not found: "${fields.trainer}".`);
            patch.trainer_id = studentTrainer.id;
          }
          const { error } = await db.from("students").update(patch).eq("id", found.row.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, id: found.row.id, message: `Updated ${found.row.name}.` });
        }

        case "trainer": {
          const t = matchByName(await getTrainers(), identifier);
          if (!t) return err(`Trainer not found: "${identifier}". Use list_trainers to see options.`);
          const patch: Record<string, unknown> = {};
          if ("name" in fields) patch.name = String(fields.name);
          if ("email" in fields) patch.email = String(fields.email);
          if ("specialization" in fields) patch.specialization = String(fields.specialization);
          if ("monthly_salary_pkr" in fields) patch.salary = Number(fields.monthly_salary_pkr);
          if ("campus" in fields) {
            const campus = matchByName(await getCampuses(), String(fields.campus));
            if (!campus) return err(`Campus not found: "${fields.campus}".`);
            patch.campus_id = campus.id;
          }
          const { error } = await db.from("trainers").update(patch).eq("id", t.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, id: t.id, message: `Updated ${t.name}.` });
        }

        case "course": {
          const c = matchByName(await getCourses(), identifier);
          if (!c) return err(`Course not found: "${identifier}". Use list_courses to see options.`);
          const patch: Record<string, unknown> = {};
          if ("name" in fields) patch.name = String(fields.name);
          if ("status" in fields) patch.status = String(fields.status);
          if ("duration_months" in fields) patch.duration_months = Number(fields.duration_months);
          if ("started_at" in fields) patch.started_at = String(fields.started_at);
          if ("campus" in fields) {
            const campus = matchByName(await getCampuses(), String(fields.campus));
            if (!campus) return err(`Campus not found: "${fields.campus}".`);
            patch.campus_id = campus.id;
          }
          if ("trainer" in fields) {
            const courseTrainer = matchByName(await getTrainers(), String(fields.trainer));
            if (!courseTrainer) return err(`Trainer not found: "${fields.trainer}".`);
            patch.trainer_id = courseTrainer.id;
          }
          const { error } = await db.from("courses").update(patch).eq("id", c.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, id: c.id, message: `Updated ${c.name}.` });
        }

        case "campus": {
          const c = matchByName(await getCampuses(), identifier);
          if (!c) return err(`Campus not found: "${identifier}". Use list_campuses to see options.`);
          const patch: Record<string, unknown> = {};
          if ("name" in fields) patch.name = String(fields.name);
          if ("city" in fields) patch.city = String(fields.city);
          if ("address" in fields) patch.address = String(fields.address);
          if ("established" in fields) patch.established = String(fields.established);
          const { error } = await db.from("campuses").update(patch).eq("id", c.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, id: c.id, message: `Updated ${c.name}.` });
        }

        case "active_class": {
          const { classes } = await searchActiveClasses({ pageSize: 50, query: identifier });
          const cls = matchByName(classes, identifier);
          if (!cls) return err(`Active class not found: "${identifier}". Use list_active_classes to see options.`);
          const patch: Record<string, unknown> = {};
          if ("name" in fields) patch.name = String(fields.name);
          if ("student_count" in fields) patch.student_count = Number(fields.student_count);
          if ("timing" in fields) patch.timing = String(fields.timing);
          if ("campus" in fields) {
            const campus = matchByName(await getCampuses(), String(fields.campus));
            if (!campus) return err(`Campus not found: "${fields.campus}".`);
            patch.campus_id = campus.id;
          }
          if ("trainer" in fields) {
            const classTrainer = matchByName(await getTrainers(), String(fields.trainer));
            if (!classTrainer) return err(`Trainer not found: "${fields.trainer}".`);
            patch.trainer_id = classTrainer.id;
          }
          if ("course" in fields) {
            const course = matchByName(await getCourses(), String(fields.course));
            if (!course) return err(`Course not found: "${fields.course}".`);
            patch.course_id = course.id;
          }
          const { error } = await db.from("active_classes").update(patch).eq("id", cls.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, id: cls.id, message: `Updated class "${cls.name}".` });
        }

        case "campaign": {
          const { data: campaignRows, error: cErr } = await db.from("campaigns").select("id,title");
          if (cErr) return err(cErr.message);
          const campaign = matchByName((campaignRows ?? []) as Array<{ id: string; title: string }>, identifier);
          if (!campaign) return err(`Campaign not found: "${identifier}". Check the exact title or id.`);
          const patch: Record<string, unknown> = {};
          if ("title" in fields) patch.title = String(fields.title);
          if ("tagline" in fields) patch.tagline = String(fields.tagline);
          if ("description" in fields) patch.description = String(fields.description);
          if ("category" in fields) patch.category = String(fields.category);
          if ("location" in fields) patch.location = String(fields.location);
          if ("goal_amount_pkr" in fields) patch.goal_amount = Number(fields.goal_amount_pkr);
          if ("status" in fields) patch.status = String(fields.status);
          if ("ends_at" in fields) patch.ends_at = new Date(`${String(fields.ends_at)}T23:59:59Z`).toISOString();
          const { error } = await db.from("campaigns").update(patch).eq("id", campaign.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, id: campaign.id, message: `Updated campaign "${campaign.title}".` });
        }

        case "donation": {
          const { data: donationRows, error: dErr } = await db
            .from("donations")
            .select("id,campaign_id,amount")
            .eq("id", identifier)
            .limit(1);
          if (dErr) return err(dErr.message);
          const donation = donationRows?.[0];
          if (!donation) return err(`Donation not found: "${identifier}". Use the donation id.`);
          const patch: Record<string, unknown> = {};
          if ("donor_name" in fields) patch.donor_name = String(fields.donor_name);
          if ("method" in fields) patch.method = String(fields.method);
          if ("message" in fields) patch.message = String(fields.message);
          if ("is_anonymous" in fields) patch.is_anonymous = Boolean(fields.is_anonymous);
          if ("amount_pkr" in fields) {
            const newAmount = Number(fields.amount_pkr);
            const delta = newAmount - Number(donation.amount);
            patch.amount = newAmount;
            const { data: campaignRow } = await db
              .from("campaigns")
              .select("raised_amount")
              .eq("id", donation.campaign_id)
              .single();
            if (campaignRow) {
              await db
                .from("campaigns")
                .update({ raised_amount: Number(campaignRow.raised_amount) + delta })
                .eq("id", donation.campaign_id);
            }
          }
          const { error } = await db.from("donations").update(patch).eq("id", donation.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, id: donation.id, message: `Updated donation ${donation.id}.` });
        }

        default:
          return err(`Unknown entity: "${entity}". Must be one of student, trainer, course, campus, active_class, campaign, donation.`);
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
          const { error } = await db.from("students").delete().eq("id", found.row.id);
          if (error) return err(error.message);
          // Decrement denormalized counters — symmetric with create_student's increments.
          const [{ data: campusRow }, { data: courseRow }, { data: trainerRow }] = await Promise.all([
            db.from("campuses").select("student_count").eq("id", found.row.campus_id).single(),
            db.from("courses").select("enrolled_count").eq("id", found.row.course_id).single(),
            db.from("trainers").select("student_count").eq("id", found.row.trainer_id).single(),
          ]);
          await Promise.all([
            campusRow &&
              db
                .from("campuses")
                .update({ student_count: Math.max(0, Number(campusRow.student_count) - 1) })
                .eq("id", found.row.campus_id),
            courseRow &&
              db
                .from("courses")
                .update({ enrolled_count: Math.max(0, Number(courseRow.enrolled_count) - 1) })
                .eq("id", found.row.course_id),
            trainerRow &&
              db
                .from("trainers")
                .update({ student_count: Math.max(0, Number(trainerRow.student_count) - 1) })
                .eq("id", found.row.trainer_id),
          ]);
          return JSON.stringify({ success: true, message: `Deleted student ${found.row.name}.` });
        }

        case "trainer": {
          const t = matchByName(await getTrainers(), identifier);
          if (!t) return err(`Trainer not found: "${identifier}".`);
          const [{ count: studentDeps }, { count: courseDeps }, { count: classDeps }] = await Promise.all([
            db.from("students").select("*", { count: "exact", head: true }).eq("trainer_id", t.id),
            db.from("courses").select("*", { count: "exact", head: true }).eq("trainer_id", t.id),
            db.from("active_classes").select("*", { count: "exact", head: true }).eq("trainer_id", t.id),
          ]);
          if ((studentDeps ?? 0) > 0 || (courseDeps ?? 0) > 0 || (classDeps ?? 0) > 0) {
            return err(
              `Can't delete ${t.name} — still linked to ${studentDeps ?? 0} students, ${courseDeps ?? 0} courses, and ${classDeps ?? 0} active classes. Reassign or delete those first.`,
            );
          }
          const { error } = await db.from("trainers").delete().eq("id", t.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, message: `Deleted trainer ${t.name}.` });
        }

        case "course": {
          const c = matchByName(await getCourses(), identifier);
          if (!c) return err(`Course not found: "${identifier}".`);
          const [{ count: studentDeps }, { count: classDeps }] = await Promise.all([
            db.from("students").select("*", { count: "exact", head: true }).eq("course_id", c.id),
            db.from("active_classes").select("*", { count: "exact", head: true }).eq("course_id", c.id),
          ]);
          if ((studentDeps ?? 0) > 0 || (classDeps ?? 0) > 0) {
            return err(
              `Can't delete "${c.name}" — still linked to ${studentDeps ?? 0} students and ${classDeps ?? 0} active classes. Reassign or delete those first.`,
            );
          }
          const { error } = await db.from("courses").delete().eq("id", c.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, message: `Deleted course "${c.name}".` });
        }

        case "campus": {
          const c = matchByName(await getCampuses(), identifier);
          if (!c) return err(`Campus not found: "${identifier}".`);
          const [{ count: studentDeps }, { count: trainerDeps }, { count: courseDeps }] = await Promise.all([
            db.from("students").select("*", { count: "exact", head: true }).eq("campus_id", c.id),
            db.from("trainers").select("*", { count: "exact", head: true }).eq("campus_id", c.id),
            db.from("courses").select("*", { count: "exact", head: true }).eq("campus_id", c.id),
          ]);
          if ((studentDeps ?? 0) > 0 || (trainerDeps ?? 0) > 0 || (courseDeps ?? 0) > 0) {
            return err(
              `Can't delete "${c.name}" — still linked to ${studentDeps ?? 0} students, ${trainerDeps ?? 0} trainers, and ${courseDeps ?? 0} courses. Reassign or delete those first.`,
            );
          }
          const { error } = await db.from("campuses").delete().eq("id", c.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, message: `Deleted campus "${c.name}".` });
        }

        case "active_class": {
          const { classes } = await searchActiveClasses({ pageSize: 50, query: identifier });
          const cls = matchByName(classes, identifier);
          if (!cls) return err(`Active class not found: "${identifier}".`);
          const { error } = await db.from("active_classes").delete().eq("id", cls.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, message: `Deleted class "${cls.name}".` });
        }

        case "campaign": {
          const { data: campaignRows, error: cErr } = await db.from("campaigns").select("id,title");
          if (cErr) return err(cErr.message);
          const campaign = matchByName((campaignRows ?? []) as Array<{ id: string; title: string }>, identifier);
          if (!campaign) return err(`Campaign not found: "${identifier}".`);
          const { count: donationDeps } = await db
            .from("donations")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id);
          if ((donationDeps ?? 0) > 0) {
            return err(`Can't delete "${campaign.title}" — it has ${donationDeps} donations recorded against it. Remove those first.`);
          }
          const { error } = await db.from("campaigns").delete().eq("id", campaign.id);
          if (error) return err(error.message);
          return JSON.stringify({ success: true, message: `Deleted campaign "${campaign.title}".` });
        }

        case "donation": {
          const { data: donationRows, error: dErr } = await db
            .from("donations")
            .select("id,campaign_id,amount")
            .eq("id", identifier)
            .limit(1);
          if (dErr) return err(dErr.message);
          const donation = donationRows?.[0];
          if (!donation) return err(`Donation not found: "${identifier}". Use the donation id.`);
          const { error } = await db.from("donations").delete().eq("id", donation.id);
          if (error) return err(error.message);
          const { data: campaignRow } = await db
            .from("campaigns")
            .select("raised_amount,donor_count")
            .eq("id", donation.campaign_id)
            .single();
          if (campaignRow) {
            await db
              .from("campaigns")
              .update({
                raised_amount: Math.max(0, Number(campaignRow.raised_amount) - Number(donation.amount)),
                donor_count: Math.max(0, Number(campaignRow.donor_count) - 1),
              })
              .eq("id", donation.campaign_id);
          }
          return JSON.stringify({ success: true, message: `Deleted donation ${donation.id} and adjusted campaign totals.` });
        }

        default:
          return err(`Unknown entity: "${entity}". Must be one of student, trainer, course, campus, active_class, campaign, donation.`);
      }
    }

    default:
      return err(`Unknown tool: ${name}`);
  }
}
