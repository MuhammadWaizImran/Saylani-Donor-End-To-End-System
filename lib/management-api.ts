/**
 * Management data access layer — LIVE MongoDB queries (server-side only),
 * reading the company's real `smit-test` database.
 *
 * Shape note: the app models a "Student" as one flat row, but the real data
 * splits it across `students` (personal info) ⋈ `student_inductions`
 * (enrolment — campus/course/trainer/status). Every Student here is really
 * one induction joined to its student. Fields the real system doesn't track
 * (progress %, attendance %, placement/company/salary) are derived from the
 * enrolment `status` or left empty — see the derive* helpers below.
 *
 * Every function falls back to the bundled mock data if MongoDB is
 * unreachable/unconfigured, so the app never hard-fails.
 */
import { ObjectId } from "mongodb";
import type {
  ActiveClass,
  Campus,
  Course,
  OrgStats,
  Student,
  Trainer,
} from "@/types/management";
import { isMongoConfigured, mongo } from "@/lib/mongodb";
import * as mock from "@/lib/management-mock";

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const s = (v: unknown) => String(v ?? "");
const n = (v: unknown) => Number(v ?? 0);
const isHexId = (v: string) => /^[a-f0-9]{24}$/i.test(v);

/** Match a stored FK that may be an ObjectId or a string id. */
function idMatch(id?: string) {
  if (!id) return undefined;
  const or: unknown[] = [id];
  if (isHexId(id)) or.push(new ObjectId(id));
  return { $in: or };
}
function escapeRegex(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Run a live query, falling back to mock data on any failure. */
async function live<T>(fallback: () => T, query: () => Promise<T>): Promise<T> {
  if (!isMongoConfigured()) return fallback();
  try {
    return await query();
  } catch (error) {
    console.error("[management-api] falling back to mock:", (error as Error).message);
    return fallback();
  }
}

/* ── status → derived academic fields ──────────────────────────
 * Their system tracks an enrolment `status`, not progress/attendance
 * percentages or placements. We surface status faithfully and derive the
 * UI's progress/attendance indicators from it. There is NO placement data,
 * so no student is ever "placed". */
const ACTIVE_STATUSES = ["enrolled", "pending"];
const GRADUATED_STATUSES = ["passed", "completed"];

const deriveEnrollment = (st: string): Student["enrollmentStatus"] =>
  ACTIVE_STATUSES.includes(st) ? "active" : "inactive";
const derivePlacement = (st: string): Student["placementStatus"] =>
  GRADUATED_STATUSES.includes(st) ? "seeking" : "studying";
const deriveProgress = (st: string): number =>
  GRADUATED_STATUSES.includes(st) ? 100 : st === "enrolled" ? 55 : st === "pending" ? 18 : 5;
const deriveAttendance = (st: string): number =>
  GRADUATED_STATUSES.includes(st) ? 90 : st === "enrolled" ? 76 : st === "pending" ? 42 : 20;

/* ── cached name maps (tiny reference collections) ─────────────── */
interface NameMaps {
  cityName: Record<string, string>;
  campusName: Record<string, string>;
  courseName: Record<string, string>;
  trainerName: Record<string, string>;
  newCourseToCourse: Record<string, string>;
}
let mapsCache: { t: number; data: NameMaps } | null = null;

async function nameMaps(): Promise<NameMaps> {
  // Short TTL (matches the dashboard's ~8s polling) so names of newly added
  // campuses/courses/trainers resolve almost as fast as their rows appear.
  if (mapsCache && Date.now() - mapsCache.t < 8_000) return mapsCache.data;
  const db = await mongo();
  const [cities, campuses, courses, trainers, newCourses] = await Promise.all([
    db.collection("cities").find({}, { projection: { en: 1 } }).toArray(),
    db.collection("campus").find({}, { projection: { en: 1 } }).toArray(),
    db.collection("courses").find({}, { projection: { en: 1 } }).toArray(),
    db.collection("trainers").find({}, { projection: { en: 1 } }).toArray(),
    db.collection("new_courses").find({}, { projection: { course: 1 } }).toArray(),
  ]);
  const data: NameMaps = {
    cityName: Object.fromEntries(cities.map((c) => [s(c._id), s(c.en?.city_name)])),
    campusName: Object.fromEntries(campuses.map((c) => [s(c._id), s(c.en?.campus_name)])),
    courseName: Object.fromEntries(courses.map((c) => [s(c._id), s(c.en?.course_name)])),
    trainerName: Object.fromEntries(trainers.map((t) => [s(t._id), s(t.en?.trainer_name)])),
    newCourseToCourse: Object.fromEntries(newCourses.map((nc) => [s(nc._id), s(nc.course)])),
  };
  mapsCache = { t: Date.now(), data };
  return data;
}

const yearOf = (v: unknown): string => {
  const d = v ? new Date(v as string) : null;
  return d && !isNaN(d.getTime()) ? String(d.getFullYear()) : "";
};

/* ── mappers ───────────────────────────────────────────────── */
function toStudent(d: Doc): Student {
  const st = s(d.status);
  return {
    id: s(d._id),
    name: s(d.stu?.full_name) || "—",
    email: s(d.stu?.email),
    phone: s(d.stu?.contact_number),
    campusId: d.campus ? s(d.campus) : "",
    courseId: d.course ? s(d.course) : "",
    trainerId: d.trainer ? s(d.trainer) : "",
    enrollmentStatus: deriveEnrollment(st),
    progressPercent: deriveProgress(st),
    attendancePercent: deriveAttendance(st),
    placementStatus: derivePlacement(st),
    company: undefined,
    salary: undefined,
    placementDate: undefined,
  };
}

/** Pipeline stages that join a student_induction to its student doc. */
const JOIN_STUDENT = [
  { $lookup: { from: "students", localField: "student_id", foreignField: "_id", as: "stu" } },
  { $unwind: { path: "$stu", preserveNullAndEmptyArrays: true } },
];

/* ── name resolution ───────────────────────────────────────── */
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
      const maps = await nameMaps();
      const src =
        table === "campuses" ? maps.campusName : table === "trainers" ? maps.trainerName : maps.courseName;
      return Object.fromEntries(unique.map((id) => [id, src[id]]).filter(([, name]) => Boolean(name)));
    },
  );
}

export interface Lookups {
  campusName: Record<string, string>;
  trainerName: Record<string, string>;
  courseName: Record<string, string>;
}

export async function getLookups(): Promise<Lookups> {
  return live(
    () => ({
      campusName: Object.fromEntries(mock.getCampuses().map((c) => [c.id, c.name])),
      trainerName: Object.fromEntries(mock.getTrainers().map((t) => [t.id, t.name])),
      courseName: Object.fromEntries(mock.getCourses().map((c) => [c.id, c.name])),
    }),
    async () => {
      const m = await nameMaps();
      return { campusName: m.campusName, trainerName: m.trainerName, courseName: m.courseName };
    },
  );
}

/* ── campuses ──────────────────────────────────────────────── */
async function campusAggregates() {
  const db = await mongo();
  const [byStudents, byTrainers, byCourses] = await Promise.all([
    db.collection("student_inductions").aggregate([
      { $match: { campus: { $ne: null } } },
      { $group: { _id: "$campus", n: { $sum: 1 }, courses: { $addToSet: "$course" } } },
    ]).toArray(),
    db.collection("trainers").aggregate([
      { $unwind: "$campus" },
      { $group: { _id: "$campus", n: { $sum: 1 } } },
    ]).toArray(),
    Promise.resolve([]),
  ]);
  const studentCount: Record<string, number> = {};
  const courseCount: Record<string, number> = {};
  for (const r of byStudents) {
    studentCount[s(r._id)] = n(r.n);
    courseCount[s(r._id)] = (r.courses as unknown[]).filter(Boolean).length;
  }
  const trainerCount: Record<string, number> = {};
  for (const r of byTrainers) trainerCount[s(r._id)] = n(r.n);
  void byCourses;
  return { studentCount, courseCount, trainerCount };
}

async function loadCampuses(): Promise<Campus[]> {
  const db = await mongo();
  const [docs, maps, agg] = await Promise.all([
    db.collection("campus").find({}).toArray(),
    nameMaps(),
    campusAggregates(),
  ]);
  return docs.map((d) => {
    const id = s(d._id);
    return {
      id,
      name: s(d.en?.campus_name) || "—",
      city: maps.cityName[s(d.city)] ?? "—",
      address: s(d.en?.address),
      established: yearOf(d.createdAt),
      studentCount: agg.studentCount[id] ?? 0,
      trainerCount: agg.trainerCount[id] ?? 0,
      courseCount: agg.courseCount[id] ?? 0,
      placementRate: 0,
      progressPercent: 0,
    };
  });
}

export function getCampuses(): Promise<Campus[]> {
  return live(mock.getCampuses, loadCampuses);
}

export interface CampusPage {
  campuses: Campus[];
  total: number;
}

export function getTopCampuses(limit = 10): Promise<CampusPage> {
  return live(
    () => ({ campuses: mock.getCampuses().slice(0, limit), total: mock.getCampuses().length }),
    async () => {
      const all = (await loadCampuses()).sort((a, b) => b.studentCount - a.studentCount);
      return { campuses: all.slice(0, limit), total: all.length };
    },
  );
}

export interface CampusSearch {
  query?: string;
  page?: number;
  pageSize?: number;
}

export function searchCampuses(opts: CampusSearch = {}): Promise<CampusPage & { page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 10));
  const paginate = (rows: Campus[]) => {
    const q = opts.query?.trim().toLowerCase();
    if (q) rows = rows.filter((r) => `${r.name} ${r.city}`.toLowerCase().includes(q));
    return { campuses: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  };
  return live(() => paginate(mock.getCampuses()), async () => paginate(await loadCampuses()));
}

/* ── students ──────────────────────────────────────────────── */
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

function studentMatch(opts: StudentSearch): Doc {
  const match: Doc = {};
  const conds: Doc[] = [];
  if (opts.campusId) match.campus = idMatch(opts.campusId);
  if (opts.courseId) match.course = idMatch(opts.courseId);
  if (opts.trainerId) match.trainer = idMatch(opts.trainerId);
  if (opts.enrollmentStatus === "active") conds.push({ status: { $in: ACTIVE_STATUSES } });
  else if (opts.enrollmentStatus === "inactive") conds.push({ status: { $nin: ACTIVE_STATUSES } });
  if (opts.placementStatus === "placed") conds.push({ status: { $in: [] } }); // no placement data
  else if (opts.placementStatus === "seeking") conds.push({ status: { $in: GRADUATED_STATUSES } });
  else if (opts.placementStatus === "studying") conds.push({ status: { $nin: GRADUATED_STATUSES } });
  if (conds.length) match.$and = conds;
  return match;
}

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
      return { students: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
    },
    async () => {
      const db = await mongo();
      const q = opts.query?.trim();
      const searchStage = q
        ? [{ $match: { $or: [
            { "stu.full_name": { $regex: escapeRegex(q), $options: "i" } },
            { "stu.email": { $regex: escapeRegex(q), $options: "i" } },
            { "stu.contact_number": { $regex: escapeRegex(q), $options: "i" } },
          ] } }]
        : [];
      const from = (page - 1) * pageSize;
      const pipeline = [
        { $match: studentMatch(opts) },
        ...JOIN_STUDENT,
        ...searchStage,
        { $sort: { _id: 1 } },
        { $facet: {
          rows: [
            { $skip: from },
            { $limit: pageSize },
            { $project: { status: 1, campus: 1, course: 1, trainer: 1,
              "stu.full_name": 1, "stu.email": 1, "stu.contact_number": 1 } },
          ],
          total: [{ $count: "n" }],
        } },
      ];
      const [res] = await db.collection("student_inductions").aggregate(pipeline).toArray();
      const students = (res?.rows ?? []).map(toStudent);
      const total = res?.total?.[0]?.n ?? 0;
      return { students, total, page, pageSize };
    },
  );
}

/** Bounded sample of students — for stats/AI context. */
export function getStudents(): Promise<Student[]> {
  return live(mock.getStudents, async () => {
    const db = await mongo();
    const docs = await db.collection("student_inductions").aggregate([
      ...JOIN_STUDENT,
      { $limit: 1000 },
      { $project: { status: 1, campus: 1, course: 1, trainer: 1,
        "stu.full_name": 1, "stu.email": 1, "stu.contact_number": 1 } },
    ]).toArray();
    return docs.map(toStudent);
  });
}

/** No placement data exists in the real system — always empty. */
export function getPlacedStudents(_limit = 200): Promise<Student[]> {
  void _limit;
  return live(mock.getPlacedStudents, async () => []);
}

export function getStudentsByTrainer(trainerId: string): Promise<Student[]> {
  return live(
    () => mock.getStudentsByTrainer(trainerId),
    async () => {
      const db = await mongo();
      const docs = await db.collection("student_inductions").aggregate([
        { $match: { trainer: idMatch(trainerId) } },
        ...JOIN_STUDENT,
        { $project: { status: 1, campus: 1, course: 1, trainer: 1,
          "stu.full_name": 1, "stu.email": 1, "stu.contact_number": 1 } },
      ]).toArray();
      return docs.map(toStudent);
    },
  );
}

/* ── trainers ──────────────────────────────────────────────── */
async function loadTrainers(): Promise<Trainer[]> {
  const db = await mongo();
  const [docs, maps, byStudents, bySlots] = await Promise.all([
    db.collection("trainers").find({}).toArray(),
    nameMaps(),
    db.collection("student_inductions").aggregate([
      { $match: { trainer: { $ne: null } } },
      { $group: { _id: "$trainer", n: { $sum: 1 } } },
    ]).toArray(),
    db.collection("slots").aggregate([
      { $match: { trainer: { $ne: null } } },
      { $group: { _id: "$trainer", n: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const studentCount: Record<string, number> = {};
  for (const r of byStudents) studentCount[s(r._id)] = n(r.n);
  const batchCount: Record<string, number> = {};
  for (const r of bySlots) batchCount[s(r._id)] = n(r.n);
  return docs.map((d) => {
    const id = s(d._id);
    const campusId = Array.isArray(d.campus) ? s(d.campus[0]) : s(d.campus);
    return {
      id,
      name: s(d.en?.trainer_name) || s(d.email) || "—",
      email: s(d.email),
      campusId,
      salary: n(d.hourly_rate),
      specialization: maps.courseName[s(d.course)] ?? "—",
      studentCount: studentCount[id] ?? 0,
      batchesCount: batchCount[id] ?? 0,
      placedCount: 0,
      performancePercent: 0,
      joinedAt: yearOf(d.createdAt),
    };
  });
}

export function getTrainers(): Promise<Trainer[]> {
  return live(mock.getTrainers, loadTrainers);
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

export function searchTrainers(opts: TrainerSearch = {}): Promise<TrainerPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const paginate = (rows: Trainer[]) => {
    if (opts.campusId) rows = rows.filter((r) => r.campusId === opts.campusId);
    const q = opts.query?.trim().toLowerCase();
    if (q) rows = rows.filter((r) => `${r.name} ${r.email} ${r.specialization}`.toLowerCase().includes(q));
    return { trainers: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  };
  return live(() => paginate(mock.getTrainers()), async () => paginate(await loadTrainers()));
}

export function getTrainer(idOrEmail: string): Promise<Trainer | undefined> {
  return live(
    () => mock.getTrainer(idOrEmail),
    async () => {
      const all = await loadTrainers();
      return all.find((t) => t.id === idOrEmail || t.email.toLowerCase() === idOrEmail.toLowerCase());
    },
  );
}

/* ── courses (from `new_courses` offerings) ────────────────── */
async function loadCourses(): Promise<Course[]> {
  const db = await mongo();
  const [docs, maps, byEnrol] = await Promise.all([
    db.collection("new_courses").find({}).toArray(),
    nameMaps(),
    db.collection("student_inductions").aggregate([
      { $match: { new_course: { $ne: null } } },
      { $group: { _id: "$new_course", n: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const enrolled: Record<string, number> = {};
  for (const r of byEnrol) enrolled[s(r._id)] = n(r.n);
  return docs.map((d) => {
    const id = s(d._id);
    const campuses = Array.isArray(d.campuses) ? d.campuses : [];
    return {
      id,
      name: maps.courseName[s(d.course)] || `Batch ${n(d.batch_number)}`,
      campusId: campuses.length ? s(campuses[0]) : "",
      trainerId: "",
      status: (d.status === true ? "running" : "completed") as Course["status"],
      enrolledCount: enrolled[id] ?? 0,
      progressPercent: 0,
      durationMonths: 0,
      startedAt: yearOf(d.createdAt),
    };
  });
}

export function getCourses(): Promise<Course[]> {
  return live(mock.getCourses, loadCourses);
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

export function searchCourses(opts: CourseSearch = {}): Promise<CoursePage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const paginate = (rows: Course[]) => {
    if (opts.campusId) rows = rows.filter((r) => r.campusId === opts.campusId);
    if (opts.trainerId) rows = rows.filter((r) => r.trainerId === opts.trainerId);
    if (opts.status) rows = rows.filter((r) => r.status === opts.status);
    const q = opts.query?.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    return { courses: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  };
  return live(() => paginate(mock.getCourses()), async () => paginate(await loadCourses()));
}

export function getCoursesByTrainer(trainerId: string): Promise<Course[]> {
  return live(
    () => mock.getCoursesByTrainer(trainerId),
    async () => {
      const db = await mongo();
      const [trainer, maps] = await Promise.all([
        db.collection("trainers").findOne({ _id: isHexId(trainerId) ? new ObjectId(trainerId) : (trainerId as unknown as ObjectId) }),
        nameMaps(),
      ]);
      const courseIds: string[] = (trainer?.courses ?? []).map((c: unknown) => s(c));
      if (courseIds.length === 0 && trainer?.course) courseIds.push(s(trainer.course));
      const byEnrol = await db.collection("student_inductions").aggregate([
        { $match: { trainer: idMatch(trainerId) } },
        { $group: { _id: "$course", n: { $sum: 1 } } },
      ]).toArray();
      const enrolled: Record<string, number> = {};
      for (const r of byEnrol) enrolled[s(r._id)] = n(r.n);
      return [...new Set(courseIds)].map((cid) => ({
        id: cid,
        name: maps.courseName[cid] ?? "—",
        campusId: Array.isArray(trainer?.campus) ? s(trainer!.campus[0]) : s(trainer?.campus),
        trainerId,
        status: "running" as Course["status"],
        enrolledCount: enrolled[cid] ?? 0,
        progressPercent: 0,
        durationMonths: 0,
        startedAt: "",
      }));
    },
  );
}

/* ── active classes (from `slots`) ─────────────────────────── */
async function loadActiveClasses(): Promise<ActiveClass[]> {
  const db = await mongo();
  const [docs, maps] = await Promise.all([
    db.collection("slots").find({}).toArray(),
    nameMaps(),
  ]);
  return docs.map((d) => {
    const courseId = maps.newCourseToCourse[s(d.new_course)] ?? "";
    const courseName = maps.courseName[courseId] ?? "Class";
    return {
      id: s(d._id),
      name: `${courseName}${d.class_type ? ` · ${s(d.class_type)}` : ""}`,
      campusId: s(d.campus),
      trainerId: s(d.trainer),
      courseId,
      studentCount: n(d.booked),
      timing: s(d.schedule),
    };
  });
}

export function getActiveClasses(): Promise<ActiveClass[]> {
  return live(mock.getActiveClasses, loadActiveClasses);
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

export function searchActiveClasses(opts: ClassSearch = {}): Promise<ClassPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 10));
  const paginate = (rows: ActiveClass[]) => {
    if (opts.campusId) rows = rows.filter((r) => r.campusId === opts.campusId);
    if (opts.trainerId) rows = rows.filter((r) => r.trainerId === opts.trainerId);
    const q = opts.query?.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    return { classes: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  };
  return live(() => paginate(mock.getActiveClasses()), async () => paginate(await loadActiveClasses()));
}

/* ── org stats ─────────────────────────────────────────────── */
export async function getOrgStats(): Promise<OrgStats> {
  return live(mock.getOrgStats, async () => {
    const db = await mongo();
    const [totalCampuses, totalStudents, totalTrainers, runningCourses, activeClasses, sample] =
      await Promise.all([
        db.collection("campus").countDocuments(),
        db.collection("student_inductions").countDocuments(),
        db.collection("trainers").countDocuments(),
        db.collection("new_courses").countDocuments({ status: true }),
        db.collection("slots").countDocuments(),
        getStudents(),
      ]);
    const active = sample.filter((st) => st.enrollmentStatus === "active");
    const avg = (values: number[]) =>
      values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return {
      totalCampuses,
      totalStudents,
      totalTrainers,
      runningCourses,
      activeClasses,
      studentsPlaced: 0, // no placement data in the real system
      avgPlacementSalary: 0,
      avgStudentProgress: avg(active.map((st) => st.progressPercent)),
      avgAttendance: avg(active.map((st) => st.attendancePercent)),
    };
  });
}
