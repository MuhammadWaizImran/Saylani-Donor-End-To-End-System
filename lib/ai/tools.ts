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
import {
  ALL_COLLECTIONS,
  DOMAIN_LABELS,
  INDEXES,
  RELATIONS,
  SCHEMA,
  UNIVERSAL_FIELDS,
  findCollection,
  redact,
  type CollectionInfo,
  type Domain,
} from "@/lib/ai/schema-map";
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
  /* ── schema discovery + generic query ───────────────────── */
  {
    type: "function" as const,
    function: {
      name: "describe_schema",
      description:
        "The real database structure. No arguments lists all 53 collections; a collection name gives its purpose, every field's meaning, its joins, and the REAL values each status/type field holds. USE THIS BEFORE filtering on any field you have not already looked up — a guessed value returns nothing and looks exactly like a true zero.",
      parameters: {
        type: "object",
        properties: {
          // Both are optional, and models routinely fill an omitted optional
          // with an explicit null — which Groq's own tool-call validator
          // rejects against a bare "string" type before the call ever
          // reaches us. Accepting null is what keeps that from 400-ing.
          collection: {
            type: ["string", "null"],
            description: "Exact collection name, e.g. quizzes, results, scholarships. Omit to list everything.",
          },
          domain: {
            type: ["string", "null"],
            enum: ["core", "lms", "attendance", "fees", "charity", "engagement", "careers", "system", null],
            description: "Optionally list only one domain's collections.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_collection",
      description:
        "Read-only query against ANY collection — how you reach the ones with no dedicated tool (quizzes, results, assignments, scholarships, ratings, events, jobs …). Call describe_schema FIRST for the real field names and values. group_by counts; omit it to fetch rows.",
      parameters: {
        type: "object",
        properties: {
          collection: { type: "string", description: "Exact collection name — see describe_schema." },
          // Every optional field accepts null: models fill omitted optionals
          // with an explicit null, and Groq 400s that against a bare type.
          filter: {
            type: ["object", "null"],
            description:
              "Equality filters {field: value}. Dotted paths work for nested fields (\"en.course_name\"); 24-char hex is matched as an id.",
            additionalProperties: true,
          },
          group_by: {
            type: ["string", "null"],
            description: "Field to group and count by. \"__month\" groups by month of createdAt.",
          },
          sum_field: { type: ["string", "null"], description: "Numeric field to total per group." },
          sort_by: { type: ["string", "null"], description: "Field to sort rows by." },
          sort_dir: { type: ["string", "null"], enum: ["asc", "desc", null], description: "Default desc." },
          limit: { type: ["number", "null"], description: "1-50, default 20." },
        },
        required: ["collection"],
      },
    },
  },
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
      name: "analyze_enrolments",
      description:
        "THE tool for any 'how many students by X' question. Groups student_inductions (one row per enrolment) by up to two dimensions with optional filters, returning real counts with resolved names.",
      parameters: {
        type: "object",
        properties: {
          group_by: {
            type: "string",
            enum: ["status", "month", "course", "campus", "trainer"],
            description: "Primary grouping dimension.",
          },
          then_by: {
            type: "string",
            enum: ["status", "month", "course", "campus", "trainer"],
            description: "Optional second dimension, e.g. group_by='course' + then_by='month'.",
          },
          status: {
            type: "string",
            description:
              "Filter to one enrolment status. Real values: enrolled, pending, passed, completed, dropout, rejected, blacklisted.",
          },
          course: { type: "string", description: "Filter to one course — name or id." },
          campus: { type: "string", description: "Filter to one campus — name or id." },
          date_field: {
            type: "string",
            enum: ["dropout_date", "enrollment_date", "createdAt"],
            description: "Which date drives month grouping. Default createdAt.",
          },
        },
        required: ["group_by"],
      },
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
      name: "analyze_fee_payments",
      description:
        "Read-only fee-invoice analysis from the real payments collection. Use for fees collected, paid/pending invoices, monthly fee ratio, invoice types, and transaction totals. This is student fee data only; NEVER use it for donations. Returns raw status values as stored plus a clearly labelled paid-like normalization.",
      parameters: {
        type: "object",
        properties: {
          group_by: { type: "string", enum: ["month", "status", "type"], description: "Primary grouping. Use month for month-wise collection." },
          billing_month: { type: "string", description: "Optional YYMM value stored in payments, for example 2607 for July 2026." },
          type: { type: "string", description: "Optional exact invoice type, e.g. monthly, registration, certificate." },
        },
        required: ["group_by"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_donations",
      description:
        "Read-only fundraising analysis from the real donations collection. Use for top donors, donation totals, and donation trends. Donations do not contain bank-account or payment-transaction fields; say that plainly instead of inventing them.",
      parameters: {
        type: "object",
        properties: {
          group_by: { type: "string", enum: ["month", "donor", "campaign"], description: "Primary grouping." },
          month: { type: "string", description: "Optional calendar month in YYYY-MM, e.g. 2026-07." },
        },
        required: ["group_by"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_attendance",
      description:
        "Read-only check-in analysis. Student check-ins come from attendances; trainer check-ins/check-outs come from trainer_attendances. Use for attendance counts, statuses, and monthly check-in trends. It does not invent attendance percentages.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", enum: ["student", "trainer"], description: "Whose attendance to inspect." },
          group_by: { type: "string", enum: ["month", "status"], description: "Primary grouping." },
          month: { type: "string", description: "Optional calendar month in YYYY-MM." },
        },
        required: ["subject", "group_by"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_academic_records",
      description:
        "Read-only analysis of results, certificates, or assignment submissions. Use for counts and status/month breakdowns. Scores are returned only for result records where a real score exists.",
      parameters: {
        type: "object",
        properties: {
          record_type: { type: "string", enum: ["results", "certificates", "assignment_submissions"] },
          group_by: { type: "string", enum: ["month", "status"], description: "Primary grouping." },
          month: { type: "string", description: "Optional calendar month in YYYY-MM." },
        },
        required: ["record_type", "group_by"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_audit_logs",
      description:
        "ADMIN ONLY: read recent database audit logs to answer who changed what and when. Returns only stored log fields; it never guesses an action or actor.",
      parameters: {
        type: "object",
        properties: {
          model: { type: "string", description: "Optional exact model/collection name to filter, e.g. students." },
          action: { type: "string", description: "Optional exact action to filter." },
          limit: { type: "number", description: "Number of most recent logs, 1 to 50." },
        },
        required: [],
      },
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

type Row = Record<string, unknown>;

/** Which collection a foreign-key field points at, derived from the same
 *  RELATIONS map describe_schema serves. Written once here rather than
 *  re-parsed per row. */
const FK_TARGET: Record<string, string> = {
  campus: "campus",
  campuses: "campus",
  city: "cities",
  country: "countries",
  course: "courses",
  courses: "courses",
  new_course: "new_courses",
  trainer: "trainers",
  slot: "slots",
  student: "students",
  student_id: "students",
  student_induction: "student_inductions",
  quiz: "quizzes",
  assignment: "assignments",
  module: "course_modules",
  course_module: "course_modules",
  course_topic: "course_topics",
  action_by: "users",
  created_by: "users",
  updated_by: "users",
  sponsored_by: "donors",
};

/** Pull a human name out of a referenced document, whatever shape it uses —
 *  this database stores names bilingually nested (en.campus_name), flat
 *  (full_name), or as a title, depending on the collection. */
function displayName(doc: Row | null): string | null {
  if (!doc) return null;
  const en = doc.en as Row | undefined;
  const nested = en && (en.campus_name ?? en.course_name ?? en.trainer_name ?? en.city_name ?? en.country_name);
  const flat = doc.full_name ?? doc.name ?? doc.title ?? doc.student_name ?? doc.email;
  const picked = nested ?? flat;
  return typeof picked === "string" ? picked.trim() : null;
}

/**
 * Replaces raw ObjectIds in returned rows with readable names.
 *
 * Without this the model gets `"campus": "67483a90…"` back, and the prompt
 * (rightly) tells it never to report a raw id — so it spends its remaining
 * tool rounds looking each one up and runs out before it can answer at all.
 * One batched lookup per referenced collection here costs a fraction of that
 * and lets the model answer from the first result.
 */
async function resolveForeignKeys(
  db: Awaited<ReturnType<typeof mongo>>,
  collection: string,
  rows: Row[],
): Promise<Row[]> {
  if (rows.length === 0) return rows;

  // Foreign keys arrive as ObjectId instances, not strings — only
  // JSON.stringify makes them look like strings later — so match on the
  // stringified form to catch both, since this database stores some keys
  // as ObjectId and some as plain hex strings.
  const hex = (v: unknown): string | null => {
    const s = typeof v === "string" ? v : v instanceof ObjectId ? v.toHexString() : "";
    return /^[a-f0-9]{24}$/i.test(s) ? s : null;
  };

  // Gather every id referenced, grouped by the collection it points at.
  const wanted = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      const target = FK_TARGET[field];
      if (!target || target === collection) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        const id = hex(v);
        if (!id) continue;
        if (!wanted.has(target)) wanted.set(target, new Set());
        wanted.get(target)!.add(id);
      }
    }
  }
  if (wanted.size === 0) return rows;

  // One query per referenced collection, not one per row.
  const names = new Map<string, string>();
  await Promise.all(
    [...wanted].map(async ([target, ids]) => {
      const docs = await db
        .collection(target)
        .find({ _id: { $in: [...ids].map((i) => new ObjectId(i)) } })
        .toArray()
        .catch(() => []);

      /* `new_courses` and `slots` carry no name of their own — a batch and a
         timetabled section are both identified by the COURSE they teach. One
         extra batched hop turns "683571d6…" into "Web & App Development —
         batch 12" instead of leaving the model an id it is told never to
         print. */
      let courseNames: Map<string, string> | null = null;
      if (target === "new_courses" || target === "slots") {
        const viaField = target === "new_courses" ? "course" : "new_course";
        const step1 = docs.map((d) => d[viaField]).filter(Boolean);
        const midDocs =
          target === "slots"
            ? await db.collection("new_courses").find({ _id: { $in: step1 as ObjectId[] } }).toArray().catch(() => [])
            : docs;
        const courseIds = (target === "slots" ? midDocs.map((d) => d.course) : step1).filter(Boolean);
        const courses = await db
          .collection("courses")
          .find({ _id: { $in: courseIds as ObjectId[] } })
          .toArray()
          .catch(() => []);
        courseNames = new Map(courses.map((c) => [String(c._id), displayName(c as Row) ?? ""]));
        if (target === "slots") {
          const ncToCourse = new Map(midDocs.map((m) => [String(m._id), String(m.course)]));
          for (const d of docs) {
            const cid = ncToCourse.get(String(d.new_course));
            const cname = cid ? courseNames.get(cid) : null;
            if (cname) names.set(`slots:${String(d._id)}`, `${cname} (slot)`);
          }
        }
      }

      for (const d of docs) {
        let n = displayName(d as Row);
        if (!n && target === "new_courses" && courseNames) {
          const cname = courseNames.get(String(d.course));
          if (cname) n = d.batch_number ? `${cname} — batch ${d.batch_number}` : cname;
        }
        if (n) names.set(`${target}:${String(d._id)}`, n);
      }
    }),
  );

  return rows.map((row) => {
    const out: Row = {};
    for (const [field, value] of Object.entries(row)) {
      const target = FK_TARGET[field];
      if (!target || target === collection) {
        out[field] = value;
        continue;
      }
      const nameOf = (v: unknown) => {
        const id = hex(v);
        if (!id) return v;
        const name = names.get(`${target}:${id}`);
        // A reference with no matching row is a real integrity problem in the
        // source data. Labelling it stops the model from printing a bare id
        // as though it identified something.
        return name ?? `(no matching ${target} record)`;
      };
      out[field] = Array.isArray(value) ? value.map(nameOf) : nameOf(value);
    }
    return out;
  });
}

/** Every reporting tool returns provenance so factual answers are auditable. */
function evidence(collections: string[], filters: Record<string, unknown>) {
  return {
    source_collections: collections,
    applied_filters: filters,
    generated_at: new Date().toISOString(),
  };
}

/** MongoDB payment months are stored as YYMM; expose a human-readable label. */
function paymentMonthLabel(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}$/.test(raw)) return raw || "(not set)";
  const year = 2000 + Number(raw.slice(0, 2));
  const month = Number(raw.slice(2));
  return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, "0")}` : raw;
}

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
    /* ── schema discovery ───────────────────────────────── */
    case "describe_schema": {
      const wanted = argStr(args, "collection");
      const domain = argStr(args, "domain") as Domain;

      if (wanted) {
        const found = findCollection(wanted);
        if (!found) {
          return err(
            `No collection named "${wanted}". Call describe_schema with no arguments to see the ${ALL_COLLECTIONS.length} that exist.`,
          );
        }
        // Relations and indexes are merged from their own maps rather than
        // repeated on all 53 entries. Indexes matter for query planning: an
        // indexed filter is a lookup, an unindexed one scans the collection.
        const relations = [...(RELATIONS[wanted] ?? []), ...(found.info.relations ?? [])];
        const indexes = INDEXES[wanted];
        return JSON.stringify({
          collection: wanted,
          domain: found.domain,
          purpose: found.info.purpose,
          approx_documents: found.info.approxDocs,
          fields: { ...found.info.fields, ...UNIVERSAL_FIELDS },
          ...(relations.length ? { relations } : {}),
          indexes: indexes ?? "None beyond _id — any filter here scans the whole collection. Fine at this size, but prefer an indexed field when one exists.",
          ...(found.info.gotchas ? { gotchas: found.info.gotchas } : {}),
          how_to_query: `query_collection with collection="${wanted}"`,
        });
      }

      /* Three levels, each deliberately small. Groq's free tier caps a whole
         request at 8,000 tokens, and this result is re-sent on every
         subsequent round of the same conversation — so a listing that
         described all 53 collections at once (~1,300 tokens) pushed real
         requests over the limit on its own. Names first, prose only when
         asked for. */
      if (domain && SCHEMA[domain]) {
        return JSON.stringify({
          domain,
          about: DOMAIN_LABELS[domain],
          collections: Object.fromEntries(
            Object.entries(SCHEMA[domain]).map(([n, i]) => [n, `${i.purpose} (~${i.approxDocs} docs)`]),
          ),
          next: "describe_schema with a collection name gives its fields, joins and gotchas.",
        });
      }

      return JSON.stringify({
        total_collections: ALL_COLLECTIONS.length,
        note: "Names only. Call describe_schema with domain=<name> for what each does, or collection=<name> for full fields, joins and gotchas.",
        domains: Object.fromEntries(
          (Object.entries(SCHEMA) as Array<[Domain, Record<string, CollectionInfo>]>).map(([d, group]) => [
            d,
            { about: DOMAIN_LABELS[d], collections: Object.keys(group) },
          ]),
        ),
      });
    }

    case "query_collection": {
      const collection = argStr(args, "collection");
      const found = findCollection(collection);
      // Validating against the schema map is what stops an arbitrary
      // collection name reaching the driver — the map IS the allow-list.
      if (!found) {
        return err(
          `No collection named "${collection}". Call describe_schema with no arguments to see what exists.`,
        );
      }
      if (found.info.approxDocs === 0) {
        return JSON.stringify({ collection, rows: [], note: "This collection is empty." });
      }

      /* Admin-only domains. These hold staff accounts, privilege structure,
         the audit trail and the fundraising ledger — none of it traceable to
         a trainer's own students, so the per-trainer scoping below cannot
         narrow them and they would otherwise come back whole. Matches the
         existing gates on search_audit_logs and analyze_donations. */
      if (ctx.role !== "admin" && (found.domain === "system" || found.domain === "charity")) {
        return err(`Permission denied: ${collection} is visible to admins only.`);
      }

      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20) || 20));
      const groupBy = argStr(args, "group_by");
      const sumField = argStr(args, "sum_field");

      /* Equality filters only. A 24-char hex value is matched as either an
         ObjectId or the same string, since this database stores foreign keys
         both ways depending on which service wrote the row. */
      const match: Record<string, unknown> = {};
      const rawFilter = (typeof args.filter === "object" && args.filter ? args.filter : {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(rawFilter)) {
        if (k.startsWith("$")) return err(`Filter field "${k}" is not allowed — use plain field names.`);
        match[k] = typeof v === "string" && /^[a-f0-9]{24}$/i.test(v) ? idEq(v) : v;
      }

      /* Trainers stay scoped to their own students wherever the collection
         can be traced back to an enrolment they teach. */
      if (ctx.role === "trainer" && trainer) {
        const traceable = ["student_induction", "trainer", "slot"];
        const key = traceable.find((f) => f in found.info.fields);
        if (key === "trainer") {
          match.trainer = idEq(trainer.id);
        } else if (key) {
          const mine = await db
            .collection("student_inductions")
            .find({ trainer: idEq(trainer.id) })
            .project({ _id: 1, slot: 1 })
            .toArray();
          match[key] =
            key === "slot"
              ? { $in: mine.map((d) => d.slot).filter(Boolean) }
              : { $in: mine.map((d) => d._id) };
        } else if (collection === "students" || collection === "student_inductions") {
          match._id = { $in: [] }; // handled by the dedicated student tools
          return err("Use list_students — it already scopes students to you.");
        }
      }

      if (groupBy) {
        const groupField =
          groupBy === "__month"
            ? { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }
            : `$${groupBy}`;
        const rows = await db
          .collection(collection)
          .aggregate([
            ...(Object.keys(match).length ? [{ $match: match }] : []),
            {
              $group: {
                _id: groupField,
                count: { $sum: 1 },
                ...(sumField
                  ? { total: { $sum: { $convert: { input: `$${sumField}`, to: "double", onError: 0, onNull: 0 } } } }
                  : {}),
              },
            },
            { $sort: groupBy === "__month" ? { _id: 1 } : { count: -1 } },
            { $limit: limit },
          ])
          .toArray();
        return JSON.stringify({
          evidence: evidence([collection], match),
          grouped_by: groupBy,
          rows: rows.map((r) => ({
            [groupBy]: r._id === null || r._id === undefined ? "(not set)" : String(r._id),
            count: Number(r.count ?? 0),
            ...(sumField ? { [`total_${sumField}`]: Number(r.total ?? 0) } : {}),
          })),
        });
      }

      const sortBy = argStr(args, "sort_by");
      const sortDir = argStr(args, "sort_dir") === "asc" ? 1 : -1;
      const rows = await db
        .collection(collection)
        .find(match)
        .sort(sortBy ? { [sortBy]: sortDir } : { _id: -1 })
        .limit(limit)
        .toArray();
      const total = await db.collection(collection).countDocuments(match);
      return JSON.stringify({
        evidence: evidence([collection], match),
        matched: total,
        returned: rows.length,
        ...(total > rows.length ? { note: `Showing ${rows.length} of ${total}. Narrow the filter for the rest.` } : {}),
        rows: await resolveForeignKeys(db, collection, redact(rows) as Row[]),
      });
    }

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

    case "analyze_enrolments": {
      /* Groups student_inductions — the hub collection, one row per student
       * enrolment. Every "how many students by X" question resolves here, so
       * the model never has to guess a count it can't otherwise fetch.
       *
       * Dates in this collection are inconsistent: createdAt is a real Date,
       * while dropout_date / enrollment_date are ISO strings on some records.
       * $convert with onError/onNull keeps a bad or missing value out of the
       * result instead of failing the whole aggregation. */
      const DIM_FIELD: Record<string, string> = {
        status: "$status",
        course: "$course",
        campus: "$campus",
        trainer: "$trainer",
      };
      const dateField = ["dropout_date", "enrollment_date", "createdAt"].includes(
        argStr(args, "date_field"),
      )
        ? argStr(args, "date_field")
        : "createdAt";
      const monthExpr = {
        $dateToString: {
          format: "%Y-%m",
          date: { $convert: { input: `$${dateField}`, to: "date", onError: null, onNull: null } },
        },
      };
      const dimExpr = (d: string) => (d === "month" ? monthExpr : DIM_FIELD[d]);

      const groupBy = argStr(args, "group_by");
      const thenBy = argStr(args, "then_by");
      if (!DIM_FIELD[groupBy] && groupBy !== "month") {
        return err(`group_by must be one of: status, month, course, campus, trainer.`);
      }

      // Filters
      const match: Record<string, unknown> = {};
      const statusFilter = argStr(args, "status");
      if (statusFilter) match.status = statusFilter.toLowerCase();
      if (argStr(args, "course")) {
        const c = matchByName(await getCourses(), argStr(args, "course"));
        if (!c) return err(`Course not found: "${argStr(args, "course")}". Use list_courses to see options.`);
        // student_inductions.course points at the catalog course; new_course
        // points at the specific offering. Match either so a course filter
        // works whichever id the caller resolved.
        match.$or = [{ course: idEq(c.id) }, { new_course: idEq(c.id) }];
      }
      if (argStr(args, "campus")) {
        const cam = matchByName(await getCampuses(), argStr(args, "campus"));
        if (!cam) return err(`Campus not found: "${argStr(args, "campus")}". Use list_campuses to see options.`);
        match.campus = idEq(cam.id);
      }

      const groupId: Record<string, unknown> = { a: dimExpr(groupBy) };
      if (thenBy && (DIM_FIELD[thenBy] || thenBy === "month")) groupId.b = dimExpr(thenBy);

      const rows = await db
        .collection("student_inductions")
        .aggregate([
          ...(Object.keys(match).length ? [{ $match: match }] : []),
          { $group: { _id: groupId, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 100 },
        ])
        .toArray();

      // Resolve ids → names so the model reports "HACK", not "652c0e40…".
      const needName = (d: string) => d === "course" || d === "campus" || d === "trainer";
      const table = needName(groupBy) ? (groupBy === "course" ? "courses" : groupBy === "campus" ? "campuses" : "trainers") : null;
      const table2 = thenBy && needName(thenBy) ? (thenBy === "course" ? "courses" : thenBy === "campus" ? "campuses" : "trainers") : null;
      const [names1, names2] = await Promise.all([
        table ? resolveNames(table, rows.map((r) => String(r._id.a ?? ""))) : Promise.resolve({}),
        table2 ? resolveNames(table2, rows.map((r) => String(r._id.b ?? ""))) : Promise.resolve({}),
      ]);
      const label = (d: string, v: unknown, map: Record<string, string>) => {
        const raw = String(v ?? "");
        if (!raw || raw === "null") return d === "month" ? "(no date recorded)" : "(not set)";
        // Some course names carry stray tabs/whitespace in the source data.
        return (needName(d) ? (map[raw] ?? raw) : raw).trim();
      };

      const out = rows.map((r) => ({
        [groupBy]: label(groupBy, r._id.a, names1),
        ...(groupId.b !== undefined ? { [thenBy]: label(thenBy, r._id.b, names2) } : {}),
        count: Number(r.count ?? 0),
      }));

      return JSON.stringify({
        grouped_by: thenBy ? `${groupBy} + ${thenBy}` : groupBy,
        ...(groupBy === "month" || thenBy === "month" ? { month_based_on: dateField } : {}),
        filters: {
          status: statusFilter || null,
          course: argStr(args, "course") || null,
          campus: argStr(args, "campus") || null,
        },
        total_matching_enrolments: out.reduce((sum, r) => sum + r.count, 0),
        rows: out,
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

    case "analyze_fee_payments": {
      if (ctx.role !== "admin") return err("Permission denied: fee reports are visible to admins only.");
      const groupBy = argStr(args, "group_by");
      if (!["month", "status", "type"].includes(groupBy)) return err("group_by must be month, status, or type.");
      const match: Record<string, unknown> = {};
      const billingMonth = argStr(args, "billing_month");
      const type = argStr(args, "type");
      if (billingMonth) match.billing_month = billingMonth;
      if (type) match.type = type;
      const groupField = groupBy === "month" ? "$billing_month" : groupBy === "status" ? "$status" : "$type";
      const [report] = await db.collection("payments").aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        {
          $set: {
            invoice_amount: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } },
            transaction_amount_value: { $convert: { input: "$transaction_amount", to: "double", onError: 0, onNull: 0 } },
            raw_status: { $ifNull: ["$status", "(not set)"] },
          },
        },
        { $set: { paid_like: { $regexMatch: { input: { $toLower: "$raw_status" }, regex: "^pa" } } } },
        {
          $facet: {
            rows: [
              {
                $group: {
                  _id: groupField,
                  invoices: { $sum: 1 },
                  invoiced_amount_pkr: { $sum: "$invoice_amount" },
                  paid_like_invoices: { $sum: { $cond: ["$paid_like", 1, 0] } },
                  paid_like_invoice_amount_pkr: { $sum: { $cond: ["$paid_like", "$invoice_amount", 0] } },
                  recorded_transaction_amount_pkr: { $sum: "$transaction_amount_value" },
                },
              },
              { $sort: { invoiced_amount_pkr: -1 } },
            ],
            raw_statuses: [{ $group: { _id: "$raw_status", invoices: { $sum: 1 } } }, { $sort: { invoices: -1 } }],
          },
        },
      ]).toArray();
      interface FeeRow {
        [groupBy: string]: string | number;
        invoices: number;
        invoiced_amount_pkr: number;
        paid_like_invoices: number;
        paid_like_invoice_amount_pkr: number;
        recorded_transaction_amount_pkr: number;
      }
      const rows: FeeRow[] = ((report?.rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
        [groupBy]: groupBy === "month" ? paymentMonthLabel(r._id) : String(r._id ?? "(not set)"),
        invoices: Number(r.invoices ?? 0),
        invoiced_amount_pkr: Number(r.invoiced_amount_pkr ?? 0),
        paid_like_invoices: Number(r.paid_like_invoices ?? 0),
        paid_like_invoice_amount_pkr: Number(r.paid_like_invoice_amount_pkr ?? 0),
        recorded_transaction_amount_pkr: Number(r.recorded_transaction_amount_pkr ?? 0),
      }));
      return JSON.stringify({
        evidence: evidence(["payments"], match),
        paid_like_rule: "Raw payment status beginning with 'pa' after lowercasing (raw status breakdown is included).",
        totals: rows.reduce<{ invoices: number; invoiced_amount_pkr: number; paid_like_invoices: number; paid_like_invoice_amount_pkr: number; recorded_transaction_amount_pkr: number }>(
          (sum, row) => ({
            invoices: sum.invoices + row.invoices,
            invoiced_amount_pkr: sum.invoiced_amount_pkr + row.invoiced_amount_pkr,
            paid_like_invoices: sum.paid_like_invoices + row.paid_like_invoices,
            paid_like_invoice_amount_pkr: sum.paid_like_invoice_amount_pkr + row.paid_like_invoice_amount_pkr,
            recorded_transaction_amount_pkr: sum.recorded_transaction_amount_pkr + row.recorded_transaction_amount_pkr,
          }),
          { invoices: 0, invoiced_amount_pkr: 0, paid_like_invoices: 0, paid_like_invoice_amount_pkr: 0, recorded_transaction_amount_pkr: 0 },
        ),
        raw_status_breakdown: ((report?.raw_statuses ?? []) as Array<Record<string, unknown>>).map((r) => ({ status: String(r._id), invoices: Number(r.invoices ?? 0) })),
        rows,
      });
    }

    case "analyze_donations": {
      if (ctx.role !== "admin") return err("Permission denied: donation reports are visible to admins only.");
      const groupBy = argStr(args, "group_by");
      if (!["month", "donor", "campaign"].includes(groupBy)) return err("group_by must be month, donor, or campaign.");
      const match: Record<string, unknown> = {};
      const month = argStr(args, "month");
      if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) return err("month must use YYYY-MM, for example 2026-07.");
        const start = new Date(`${month}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        match.created_at_date = { $gte: start, $lt: end };
      }
      const groupField = groupBy === "month"
        ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
        : groupBy === "donor" ? "$donorName" : "$campaignId";
      const rows = await db.collection("donations").aggregate([
        { $set: { created_at_date: { $convert: { input: "$createdAt", to: "date", onError: null, onNull: null } } } },
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        { $set: { amount_value: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } },
        { $group: { _id: groupBy === "month" ? { $dateToString: { format: "%Y-%m", date: "$created_at_date" } } : groupField, donations: { $sum: 1 }, amount_pkr: { $sum: "$amount_value" } } },
        { $sort: { amount_pkr: -1 } },
        { $limit: 100 },
      ]).toArray();
      const campaignIds = rows.map((r) => String(r._id ?? "")).filter(Boolean);
      const campaigns = campaignIds.length
        ? await db.collection("campaigns").find({ $or: [{ _id: { $in: campaignIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } }, { id: { $in: campaignIds } }] }).project({ id: 1, title: 1 }).toArray()
        : [];
      const campaignNames = Object.fromEntries(campaigns.flatMap((c) => [[String(c._id), String(c.title ?? c.id ?? c._id)], [String(c.id ?? ""), String(c.title ?? c.id ?? c._id)]]));
      const output = rows.map((r) => ({
        [groupBy]: groupBy === "campaign" ? (campaignNames[String(r._id)] ?? String(r._id ?? "(not set)")) : String(r._id ?? "(not set)"),
        donations: Number(r.donations ?? 0),
        amount_pkr: Number(r.amount_pkr ?? 0),
      }));
      return JSON.stringify({
        evidence: evidence(["donations", "campaigns"], match),
        note: "The donations collection has no bank-account or payment-transaction fields.",
        total_donations: output.reduce((sum, row) => sum + row.donations, 0),
        total_amount_pkr: output.reduce((sum, row) => sum + row.amount_pkr, 0),
        rows: output,
      });
    }

    case "analyze_attendance": {
      const subject = argStr(args, "subject");
      const groupBy = argStr(args, "group_by");
      if (subject !== "student" && subject !== "trainer") return err("subject must be student or trainer.");
      if (groupBy !== "month" && groupBy !== "status") return err("group_by must be month or status.");
      const collection = subject === "student" ? "attendances" : "trainer_attendances";
      const match: Record<string, unknown> = {};
      const month = argStr(args, "month");
      if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) return err("month must use YYYY-MM, for example 2026-07.");
        const start = new Date(`${month}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        match.createdAt = { $gte: start, $lt: end };
      }
      if (ctx.role === "trainer") {
        if (subject === "trainer") match.trainer = idEq(trainer!.id);
        else {
          const inductions = await db.collection("student_inductions").find({ trainer: idEq(trainer!.id) }).project({ _id: 1 }).toArray();
          match.student_induction = { $in: inductions.map((d) => d._id) };
        }
      }
      const groupField = groupBy === "month" ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } } : "$status";
      const rows = await db.collection(collection).aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        { $group: { _id: groupField, check_ins: { $sum: 1 }, average_minutes: { $avg: { $convert: { input: "$minutes", to: "double", onError: null, onNull: null } } } } },
        { $sort: { check_ins: -1 } },
        { $limit: 100 },
      ]).toArray();
      return JSON.stringify({
        evidence: evidence([collection], match),
        subject,
        rows: rows.map((r) => ({ [groupBy]: String(r._id ?? "(not set)"), check_ins: Number(r.check_ins ?? 0), ...(subject === "trainer" ? { average_minutes: Math.round(Number(r.average_minutes ?? 0)) } : {}) })),
      });
    }

    case "analyze_academic_records": {
      const collection = argStr(args, "record_type");
      const groupBy = argStr(args, "group_by");
      if (!["results", "certificates", "assignment_submissions"].includes(collection)) return err("record_type must be results, certificates, or assignment_submissions.");
      if (groupBy !== "month" && groupBy !== "status") return err("group_by must be month or status.");
      const match: Record<string, unknown> = {};
      const month = argStr(args, "month");
      if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) return err("month must use YYYY-MM, for example 2026-07.");
        const start = new Date(`${month}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        match.createdAt = { $gte: start, $lt: end };
      }
      if (ctx.role === "trainer") {
        const inductions = await db.collection("student_inductions").find({ trainer: idEq(trainer!.id) }).project({ _id: 1 }).toArray();
        match.student_induction = { $in: inductions.map((d) => d._id) };
      }
      const groupField = groupBy === "month" ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } } : "$status";
      const rows = await db.collection(collection).aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        { $group: { _id: groupField, records: { $sum: 1 }, average_score: { $avg: { $convert: { input: "$score", to: "double", onError: null, onNull: null } } } } },
        { $sort: { records: -1 } },
        { $limit: 100 },
      ]).toArray();
      return JSON.stringify({
        evidence: evidence([collection], match),
        record_type: collection,
        rows: rows.map((r) => ({ [groupBy]: String(r._id ?? "(not set)"), records: Number(r.records ?? 0), ...(collection === "results" ? { average_score: Number(r.average_score ?? 0) } : {}) })),
      });
    }

    case "search_audit_logs": {
      if (ctx.role !== "admin") return err("Permission denied: audit logs are visible to admins only.");
      const match: Record<string, unknown> = {};
      const model = argStr(args, "model");
      const action = argStr(args, "action");
      if (model) match.model = model;
      if (action) match.action = action;
      const requestedLimit = Number(args.limit ?? 20);
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 20;
      const rows = await db.collection("logs").find(match).sort({ createdAt: -1 }).limit(limit).project({ action: 1, action_by: 1, model: 1, method: 1, route: 1, doc_id: 1, createdAt: 1, changed_fields: 1 }).toArray();
      return JSON.stringify({
        evidence: evidence(["logs"], match),
        rows: rows.map((r) => ({ action: r.action ?? null, action_by: r.action_by ?? null, model: r.model ?? null, method: r.method ?? null, route: r.route ?? null, record_id: r.doc_id ? String(r.doc_id) : null, changed_fields: r.changed_fields ?? null, created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt ?? null })),
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
