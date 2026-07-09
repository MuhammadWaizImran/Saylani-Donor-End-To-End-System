/**
 * Management data access layer — LIVE Supabase queries (server-side only).
 *
 * Every function falls back to the bundled mock data if Supabase is
 * unreachable/unconfigured, so the app never hard-fails.
 */
import type {
  ActiveClass,
  Campus,
  Course,
  OrgStats,
  Student,
  Trainer,
} from "@/types/management";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase";
import * as mock from "@/lib/management-mock";

/* ── row mappers (snake_case → camelCase) ─────────────────── */

type Row = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "");
const n = (v: unknown) => Number(v ?? 0);

const toCampus = (r: Row): Campus => ({
  id: s(r.id), name: s(r.name), city: s(r.city), address: s(r.address),
  established: s(r.established), studentCount: n(r.student_count),
  trainerCount: n(r.trainer_count), courseCount: n(r.course_count),
  placementRate: n(r.placement_rate), progressPercent: n(r.progress_percent),
});

const toTrainer = (r: Row): Trainer => ({
  id: s(r.id), name: s(r.name), email: s(r.email), campusId: s(r.campus_id),
  salary: n(r.salary), specialization: s(r.specialization),
  studentCount: n(r.student_count), batchesCount: n(r.batches_count),
  placedCount: n(r.placed_count), performancePercent: n(r.performance_percent),
  joinedAt: s(r.joined_at),
});

const toCourse = (r: Row): Course => ({
  id: s(r.id), name: s(r.name), campusId: s(r.campus_id), trainerId: s(r.trainer_id),
  status: s(r.status) as Course["status"], enrolledCount: n(r.enrolled_count),
  progressPercent: n(r.progress_percent), durationMonths: n(r.duration_months),
  startedAt: s(r.started_at),
});

const toStudent = (r: Row): Student => ({
  id: s(r.id), name: s(r.name), email: s(r.email), phone: s(r.phone),
  campusId: s(r.campus_id), courseId: s(r.course_id), trainerId: s(r.trainer_id),
  enrollmentStatus: s(r.enrollment_status) as Student["enrollmentStatus"],
  progressPercent: n(r.progress_percent), attendancePercent: n(r.attendance_percent),
  placementStatus: s(r.placement_status) as Student["placementStatus"],
  company: r.company ? s(r.company) : undefined,
  salary: r.salary == null ? undefined : n(r.salary),
  placementDate: r.placement_date ? s(r.placement_date) : undefined,
});

const toActiveClass = (r: Row): ActiveClass => ({
  id: s(r.id), name: s(r.name), campusId: s(r.campus_id), trainerId: s(r.trainer_id),
  courseId: s(r.course_id), studentCount: n(r.student_count), timing: s(r.timing),
});

/** Fetch a whole (lookup-sized) table, paging past PostgREST's 1000-row cap.
 *  Count first, then fetch all pages IN PARALLEL (latency ≈ 2 roundtrips,
 *  not N). Hard-capped at 20k rows — bigger tables must use paginated
 *  queries like searchStudents. */
async function fetchAll(table: string, columns = "*"): Promise<Row[]> {
  const PAGE = 1000;
  const MAX = 20_000;
  const db = supabaseServer();
  const { count, error: countError } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (countError) throw new Error(`${table}: ${countError.message}`);
  const total = Math.min(count ?? 0, MAX);
  if (total === 0) return [];

  const pages = await Promise.all(
    Array.from({ length: Math.ceil(total / PAGE) }, (_, p) =>
      db
        .from(table)
        .select(columns)
        .order("id")
        .range(p * PAGE, p * PAGE + PAGE - 1),
    ),
  );
  const rows: Row[] = [];
  for (const { data, error } of pages) {
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
  }
  return rows;
}

/** Run a live query, falling back to mock data on any failure. */
async function live<T>(fallback: () => T, query: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured()) return fallback();
  try {
    return await query();
  } catch (error) {
    console.error("[management-api] falling back to mock:", (error as Error).message);
    return fallback();
  }
}

/** Exact row count via an index-backed head query — fast at any scale.
 *  `apply` narrows the count with .eq()/.gt()/etc; typed loosely since the
 *  Supabase query-builder's filtered-vs-unfiltered types don't unify. */
async function headCount(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply?: (q: any) => any,
): Promise<number> {
  const base = supabaseServer().from(table).select("*", { count: "exact", head: true });
  const { count, error } = await (apply ? apply(base) : base);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

/** Look up just the names for a specific set of ids — a fraction of the
 *  cost of fetching (or caching) an entire lookup table, so list pages stay
 *  fast no matter how large campuses/trainers/courses grow. */
export async function resolveNames(
  table: "campuses" | "trainers" | "courses",
  ids: Array<string | undefined>,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};
  return live(
    () => {
      const rows =
        table === "campuses" ? mock.getCampuses() : table === "trainers" ? mock.getTrainers() : mock.getCourses();
      return Object.fromEntries(rows.filter((r) => unique.includes(r.id)).map((r) => [r.id, r.name]));
    },
    async () => {
      const { data, error } = await supabaseServer().from(table).select("id,name").in("id", unique);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map((r) => [s(r.id), s(r.name)]));
    },
  );
}

/* ── reads ─────────────────────────────────────────────────── */

export function getCampuses(): Promise<Campus[]> {
  return live(mock.getCampuses, async () => (await fetchAll("campuses")).map(toCampus));
}

export interface CampusPage {
  campuses: Campus[];
  total: number;
}

/** The N largest campuses (by student count) — for dashboard summaries,
 *  which should never render the entire (potentially huge) campus table. */
export function getTopCampuses(limit = 10): Promise<CampusPage> {
  return live(
    () => ({ campuses: mock.getCampuses().slice(0, limit), total: mock.getCampuses().length }),
    async () => {
      const db = supabaseServer();
      const [{ data, error }, total] = await Promise.all([
        db.from("campuses").select("*").order("student_count", { ascending: false }).limit(limit),
        headCount("campuses"),
      ]);
      if (error) throw new Error(error.message);
      return { campuses: (data ?? []).map(toCampus), total };
    },
  );
}

export interface CampusSearch {
  query?: string;
  page?: number;
  pageSize?: number;
}

/** Server-side filtered + paginated campus search. */
export function searchCampuses(opts: CampusSearch = {}): Promise<CampusPage & { page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 10));
  return live(
    () => {
      let rows = mock.getCampuses();
      const q = opts.query?.trim().toLowerCase();
      if (q) rows = rows.filter((r) => `${r.name} ${r.city}`.toLowerCase().includes(q));
      return { campuses: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
    },
    async () => {
      let query = supabaseServer().from("campuses").select("*", { count: "exact" });
      const q = opts.query?.trim().replace(/[%,()]/g, " ").trim();
      if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.order("id").range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      return { campuses: (data ?? []).map(toCampus), total: count ?? 0, page, pageSize };
    },
  );
}

/** Bounded sample of students — for stats/AI context. Use searchStudents for browsing. */
export function getStudents(): Promise<Student[]> {
  return live(mock.getStudents, async () => {
    const { data, error } = await supabaseServer().from("students").select("*").limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toStudent);
  });
}

export interface StudentSearch {
  query?: string;
  campusId?: string;
  courseId?: string;
  trainerId?: string;
  enrollmentStatus?: string;
  placementStatus?: string;
  maxAttendance?: number;
  page?: number;
  pageSize?: number;
}

export interface StudentPage {
  students: Student[];
  total: number;
  page: number;
  pageSize: number;
}

/** Server-side paginated + filtered student search — scales to millions of rows. */
export function searchStudents(opts: StudentSearch = {}): Promise<StudentPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  return live(
    () => {
      let rows = mock.getStudents();
      if (opts.campusId) rows = rows.filter((r) => r.campusId === opts.campusId);
      if (opts.courseId) rows = rows.filter((r) => r.courseId === opts.courseId);
      if (opts.trainerId) rows = rows.filter((r) => r.trainerId === opts.trainerId);
      if (opts.enrollmentStatus) rows = rows.filter((r) => r.enrollmentStatus === opts.enrollmentStatus);
      if (opts.placementStatus) rows = rows.filter((r) => r.placementStatus === opts.placementStatus);
      const q = opts.query?.trim().toLowerCase();
      if (q) rows = rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q));
      return {
        students: rows.slice((page - 1) * pageSize, page * pageSize),
        total: rows.length,
        page,
        pageSize,
      };
    },
    async () => {
      let query = supabaseServer().from("students").select("*", { count: "exact" });
      if (opts.campusId) query = query.eq("campus_id", opts.campusId);
      if (opts.courseId) query = query.eq("course_id", opts.courseId);
      if (opts.trainerId) query = query.eq("trainer_id", opts.trainerId);
      if (opts.enrollmentStatus) query = query.eq("enrollment_status", opts.enrollmentStatus);
      if (opts.placementStatus) query = query.eq("placement_status", opts.placementStatus);
      if (typeof opts.maxAttendance === "number")
        query = query.lte("attendance_percent", opts.maxAttendance);
      const q = opts.query?.trim();
      if (q) {
        const safe = q.replace(/[%,()]/g, " ").trim();
        if (safe) query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,company.ilike.%${safe}%`);
      }
      const from = (page - 1) * pageSize;
      // Placement listings read best most-recent-first; everything else by id.
      const { data, error, count } =
        opts.placementStatus === "placed"
          ? await query.order("placement_date", { ascending: false }).range(from, from + pageSize - 1)
          : await query.order("id").range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      return { students: (data ?? []).map(toStudent), total: count ?? 0, page, pageSize };
    },
  );
}

export function getTrainers(): Promise<Trainer[]> {
  return live(mock.getTrainers, async () => (await fetchAll("trainers")).map(toTrainer));
}

export interface TrainerSearch {
  query?: string;
  campusId?: string;
  page?: number;
  pageSize?: number;
}

export interface TrainerPage {
  trainers: Trainer[];
  total: number;
  page: number;
  pageSize: number;
}

/** Server-side filtered + paginated trainer search. */
export function searchTrainers(opts: TrainerSearch = {}): Promise<TrainerPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  return live(
    () => {
      let rows = mock.getTrainers();
      if (opts.campusId) rows = rows.filter((r) => r.campusId === opts.campusId);
      const q = opts.query?.trim().toLowerCase();
      if (q) rows = rows.filter((r) => `${r.name} ${r.email} ${r.specialization}`.toLowerCase().includes(q));
      return { trainers: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
    },
    async () => {
      let query = supabaseServer().from("trainers").select("*", { count: "exact" });
      if (opts.campusId) query = query.eq("campus_id", opts.campusId);
      const q = opts.query?.trim().replace(/[%,()]/g, " ").trim();
      if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,specialization.ilike.%${q}%`);
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.order("id").range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      return { trainers: (data ?? []).map(toTrainer), total: count ?? 0, page, pageSize };
    },
  );
}

export function getTrainer(idOrEmail: string): Promise<Trainer | undefined> {
  return live(
    () => mock.getTrainer(idOrEmail),
    async () => {
      const { data, error } = await supabaseServer()
        .from("trainers")
        .select("*")
        .or(`id.eq.${idOrEmail},email.eq.${idOrEmail}`)
        .limit(1);
      if (error) throw new Error(error.message);
      return data?.[0] ? toTrainer(data[0]) : undefined;
    },
  );
}

export function getCourses(): Promise<Course[]> {
  return live(mock.getCourses, async () => (await fetchAll("courses")).map(toCourse));
}

export interface CourseSearch {
  query?: string;
  campusId?: string;
  trainerId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface CoursePage {
  courses: Course[];
  total: number;
  page: number;
  pageSize: number;
}

/** Server-side filtered + paginated course search. */
export function searchCourses(opts: CourseSearch = {}): Promise<CoursePage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  return live(
    () => {
      let rows = mock.getCourses();
      if (opts.campusId) rows = rows.filter((r) => r.campusId === opts.campusId);
      if (opts.trainerId) rows = rows.filter((r) => r.trainerId === opts.trainerId);
      if (opts.status) rows = rows.filter((r) => r.status === opts.status);
      const q = opts.query?.trim().toLowerCase();
      if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
      return { courses: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
    },
    async () => {
      let query = supabaseServer().from("courses").select("*", { count: "exact" });
      if (opts.campusId) query = query.eq("campus_id", opts.campusId);
      if (opts.trainerId) query = query.eq("trainer_id", opts.trainerId);
      if (opts.status) query = query.eq("status", opts.status);
      const q = opts.query?.trim().replace(/[%,()]/g, " ").trim();
      if (q) query = query.ilike("name", `%${q}%`);
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.order("id").range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      return { courses: (data ?? []).map(toCourse), total: count ?? 0, page, pageSize };
    },
  );
}

export function getActiveClasses(): Promise<ActiveClass[]> {
  return live(mock.getActiveClasses, async () => (await fetchAll("active_classes")).map(toActiveClass));
}

export interface ClassSearch {
  query?: string;
  campusId?: string;
  trainerId?: string;
  page?: number;
  pageSize?: number;
}

export interface ClassPage {
  classes: ActiveClass[];
  total: number;
  page: number;
  pageSize: number;
}

/** Server-side filtered + paginated active-class search. */
export function searchActiveClasses(opts: ClassSearch = {}): Promise<ClassPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 10));
  return live(
    () => {
      let rows = mock.getActiveClasses();
      if (opts.campusId) rows = rows.filter((r) => r.campusId === opts.campusId);
      if (opts.trainerId) rows = rows.filter((r) => r.trainerId === opts.trainerId);
      const q = opts.query?.trim().toLowerCase();
      if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
      return { classes: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
    },
    async () => {
      let query = supabaseServer().from("active_classes").select("*", { count: "exact" });
      if (opts.campusId) query = query.eq("campus_id", opts.campusId);
      if (opts.trainerId) query = query.eq("trainer_id", opts.trainerId);
      const q = opts.query?.trim().replace(/[%,()]/g, " ").trim();
      if (q) query = query.ilike("name", `%${q}%`);
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.order("id").range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      return { classes: (data ?? []).map(toActiveClass), total: count ?? 0, page, pageSize };
    },
  );
}

export function getPlacedStudents(limit = 200): Promise<Student[]> {
  return live(mock.getPlacedStudents, async () => {
    const { data, error } = await supabaseServer()
      .from("students")
      .select("*")
      .eq("placement_status", "placed")
      .order("placement_date", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toStudent);
  });
}

export function getStudentsByTrainer(trainerId: string): Promise<Student[]> {
  return live(
    () => mock.getStudentsByTrainer(trainerId),
    async () => {
      const { data, error } = await supabaseServer()
        .from("students")
        .select("*")
        .eq("trainer_id", trainerId);
      if (error) throw new Error(error.message);
      return (data ?? []).map(toStudent);
    },
  );
}

export function getCoursesByTrainer(trainerId: string): Promise<Course[]> {
  return live(
    () => mock.getCoursesByTrainer(trainerId),
    async () => {
      const { data, error } = await supabaseServer()
        .from("courses")
        .select("*")
        .eq("trainer_id", trainerId);
      if (error) throw new Error(error.message);
      return (data ?? []).map(toCourse);
    },
  );
}

export async function getOrgStats(): Promise<OrgStats> {
  return live(mock.getOrgStats, async () => {
    // Every total is an index-backed head count — none of these fetch full
    // tables, so this stays fast whether campuses number 6 or 6,000.
    const [
      studentsSample, // bounded sample — used only for progress/attendance averages
      placedSample, // bounded sample — used only for the salary average
      totalCampuses,
      totalStudents,
      totalTrainers,
      runningCourses,
      activeClasses,
      studentsPlaced,
    ] = await Promise.all([
      getStudents(),
      getPlacedStudents(500),
      headCount("campuses"),
      headCount("students"),
      headCount("trainers"),
      headCount("courses", (q) => q.eq("status", "running")),
      headCount("active_classes"),
      headCount("students", (q) => q.eq("placement_status", "placed")),
    ]);
    const activeStudents = studentsSample.filter((st) => st.enrollmentStatus === "active");
    const avg = (values: number[]) =>
      values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return {
      totalCampuses,
      totalStudents,
      totalTrainers,
      runningCourses,
      activeClasses,
      studentsPlaced,
      avgPlacementSalary: avg(placedSample.map((st) => st.salary ?? 0)),
      avgStudentProgress: avg(activeStudents.map((st) => st.progressPercent)),
      avgAttendance: avg(activeStudents.map((st) => st.attendancePercent)),
    };
  });
}

/* ── lookups for rendering names from ids ──────────────────── */

export interface Lookups {
  campusName: Record<string, string>;
  trainerName: Record<string, string>;
  courseName: Record<string, string>;
}

export async function getLookups(): Promise<Lookups> {
  const map = (rows: Row[]) =>
    Object.fromEntries(rows.map((r) => [s(r.id), s(r.name)]));
  return live(
    () => ({
      campusName: map(mock.getCampuses() as unknown as Row[]),
      trainerName: map(mock.getTrainers() as unknown as Row[]),
      courseName: map(mock.getCourses() as unknown as Row[]),
    }),
    async () => {
      // Names only — a fraction of the payload of full rows.
      const [campuses, trainers, courses] = await Promise.all([
        fetchAll("campuses", "id,name"),
        fetchAll("trainers", "id,name"),
        fetchAll("courses", "id,name"),
      ]);
      return {
        campusName: map(campuses),
        trainerName: map(trainers),
        courseName: map(courses),
      };
    },
  );
}
