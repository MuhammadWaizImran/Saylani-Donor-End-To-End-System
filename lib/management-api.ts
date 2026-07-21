/**
 * Management data access layer — LIVE MongoDB queries (server-side only),
 * reading the company's real `smit-test` database.
 *
 * Shape note: the app models a "Student" as one flat row, but the real data
 * splits it across `students` (personal info) ⋈ `student_inductions`
 * (enrolment — campus/course/trainer/status). Every Student here is really
 * one induction joined to its student. Fields the real system doesn't track
 * per-student (progress %, placement/company/salary) are derived from the
 * enrolment `status` or left empty — see the derive* helpers below. Real
 * class attendance DOES exist (the `attendances` collection) but only
 * covers a handful of students — see getAttendanceOverview().
 *
 * When MongoDB is configured, every function must use it. Returning bundled
 * mock rows after a live-query failure would make an operations dashboard and
 * its AI assistant report invented figures. Mock data remains available only
 * for an intentionally unconfigured local demo.
 */
import { ObjectId } from "mongodb";
import type {
  ActiveClass,
  AttendanceOverview,
  BreakdownSlice,
  Campus,
  CampaignDetail,
  CampaignStatus,
  Course,
  CourseDetail,
  DonationOverview,
  DonorDetail,
  DualTrendPoint,
  FeeTrendPoint,
  MyProfile,
  OrgStats,
  PaymentOverview,
  PaymentStatus,
  Student,
  StudentDetail,
  Trainer,
  TrainerAttendanceOverview,
  TrainerDetail,
  TrendPoint,
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

/** Run a live query. Never replace failed production data with demo rows. */
async function live<T>(fallback: () => T, query: () => Promise<T>): Promise<T> {
  if (!isMongoConfigured()) return fallback();
  return query();
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
  /** e.g. "2 months" — the catalog's own duration text. */
  courseDuration: Record<string, string>;
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
    courseDuration: Object.fromEntries(courses.map((c) => [s(c._id), s(c.en?.course_duration)])),
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
      image: s(d.image) || undefined,
    };
  });
}

export function getCampuses(): Promise<Campus[]> {
  return live(mock.getCampuses, loadCampuses);
}

export function getCampusById(id: string): Promise<Campus | undefined> {
  return live(
    () => mock.getCampuses().find((c) => c.id === id),
    async () => (await loadCampuses()).find((c) => c.id === id),
  );
}

export interface CampusPage {
  campuses: Campus[];
  total: number;
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

/**
 * One student's complete profile: their personal record, this enrolment's
 * details, their real class attendance, and their own fee invoices.
 * `id` is the enrolment (student_induction) id — the same id the list uses.
 */
export function getStudentDetail(id: string): Promise<StudentDetail | undefined> {
  return live(
    () => undefined,
    async () => {
      if (!isHexId(id)) return undefined;
      const db = await mongo();
      const [ind] = await db
        .collection("student_inductions")
        .aggregate([{ $match: { _id: new ObjectId(id) } }, ...JOIN_STUDENT, { $limit: 1 }])
        .toArray();
      if (!ind) return undefined;

      const stu: Doc = ind.stu ?? {};
      const studentRecordId = s(ind.student_id);
      const [attRows, payDocs] = await Promise.all([
        db
          .collection("attendances")
          .aggregate([
            { $match: { student_id: idMatch(studentRecordId) } },
            { $group: { _id: null, n: { $sum: 1 }, last: { $max: "$time_stamp" } } },
          ])
          .toArray(),
        db.collection("payments").find({ student: idMatch(studentRecordId) }).toArray(),
      ]);

      const payments = payDocs
        .map((d) => ({
          id: s(d._id),
          studentId: studentRecordId,
          studentName: s(stu.full_name) || "—",
          amount: n(d.amount),
          billingMonth: formatBillingMonth(s(d.billing_month)),
          dueDate: s(d.due_date),
          status: normalizePaymentStatus(s(d.status)),
          type: s(d.type) || "—",
          invoiceNumber: s(d.blinq_invoice_number),
        }))
        .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));

      return {
        ...toStudent(ind),
        studentRecordId,
        fatherName: s(stu.father_name),
        gender: s(stu.gender),
        dateOfBirth: s(stu.date_of_birth),
        cnic: s(stu.student_cnic),
        address: s(stu.full_address),
        lastQualification: s(stu.last_qualification),
        image: s(stu.image) || undefined,
        rollNumber: s(ind.roll_number),
        batchNumber: n(ind.batch_number),
        laptop: s(ind.laptop),
        isSponsored: Boolean(ind.is_sponsored),
        sponsorMessage: s(ind.sponsor_message),
        enrolledAt: s(ind.createdAt),
        classesAttended: n(attRows[0]?.n),
        lastAttended: s(attRows[0]?.last),
        payments,
        totalPaid: payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0),
        totalPending: payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0),
      };
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

/**
 * Real per-student class attendance from the `attendances` collection.
 * Sparse by nature — only students who were ever actually marked present
 * have a row here. There is no mock/demo fallback: showing fabricated
 * attendance would be worse than honestly showing "not tracked yet".
 */
export function getAttendanceOverview(): Promise<AttendanceOverview> {
  return live(
    () => ({ records: [], studentsTracked: 0, totalStudents: 0, totalClassRecords: 0 }),
    async () => {
      const db = await mongo();
      const [rows, totalStudents] = await Promise.all([
        db
          .collection("attendances")
          .aggregate([
            {
              $group: {
                _id: "$student_id",
                classesAttended: { $sum: 1 },
                lastAttended: { $max: "$time_stamp" },
              },
            },
            { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "stu" } },
            { $unwind: { path: "$stu", preserveNullAndEmptyArrays: true } },
            // A student may hold several inductions (re-enrolled, second course).
            // Take only their latest, or the join fans one student out into
            // several rows — double-counting their check-ins in the totals.
            {
              $lookup: {
                from: "student_inductions",
                let: { sid: "$_id" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$student_id", "$$sid"] } } },
                  { $sort: { createdAt: -1 } },
                  { $limit: 1 },
                ],
                as: "ind",
              },
            },
            { $unwind: { path: "$ind", preserveNullAndEmptyArrays: true } },
            { $sort: { classesAttended: -1 } },
          ])
          .toArray(),
        db.collection("students").countDocuments(),
      ]);
      const records = rows.map((r) => ({
        studentId: s(r._id),
        name: s(r.stu?.full_name) || "—",
        campusId: r.ind?.campus ? s(r.ind.campus) : "",
        courseId: r.ind?.course ? s(r.ind.course) : "",
        classesAttended: n(r.classesAttended),
        lastAttended: s(r.lastAttended),
      }));
      const totalClassRecords = records.reduce((sum, r) => sum + r.classesAttended, 0);
      return { records, studentsTracked: records.length, totalStudents, totalClassRecords };
    },
  );
}

/**
 * Trainer check-in attendance, from the `trainer_attendances` collection
 * (check_in/check_out timestamps + a punctuality/approval workflow). We roll
 * each trainer's non-deleted sessions into one row: how many check-ins, total
 * minutes present, and how many of those were flagged late. Trainer names are
 * resolved by the page via resolveNames(), so we only return ids here — this
 * sidesteps the string-vs-ObjectId mismatch between the `trainer` ref and the
 * trainers `_id`.
 */
export function getTrainerAttendanceOverview(): Promise<TrainerAttendanceOverview> {
  return live(
    () => ({ records: [], trainersTracked: 0, totalTrainers: 0, totalSessions: 0, totalMinutes: 0 }),
    async () => {
      const db = await mongo();
      const [rows, totalTrainers] = await Promise.all([
        db
          .collection("trainer_attendances")
          .aggregate([
            { $match: { status: { $ne: "deleted" } } },
            {
              $group: {
                _id: "$trainer",
                sessions: { $sum: 1 },
                totalMinutes: { $sum: { $ifNull: ["$minutes", 0] } },
                lateSessions: {
                  $sum: {
                    $cond: [{ $gt: [{ $ifNull: ["$late_check_in_minutes", 0] }, 0] }, 1, 0],
                  },
                },
                lastCheckIn: { $max: "$check_in" },
              },
            },
            { $sort: { sessions: -1 } },
          ])
          .toArray(),
        db.collection("trainers").countDocuments(),
      ]);
      const records = rows.map((r) => ({
        trainerId: s(r._id),
        name: "", // resolved by the page via resolveNames("trainers", …)
        sessions: n(r.sessions),
        totalMinutes: n(r.totalMinutes),
        lateSessions: n(r.lateSessions),
        lastCheckIn: s(r.lastCheckIn),
      }));
      const totalSessions = records.reduce((sum, r) => sum + r.sessions, 0);
      const totalMinutes = records.reduce((sum, r) => sum + r.totalMinutes, 0);
      return { records, trainersTracked: records.length, totalTrainers, totalSessions, totalMinutes };
    },
  );
}

/* ── fundraising: campaigns / donations / donors ───────────────
 * Reads the `campaigns`, `donations`, and `public_donors` collections
 * (all camelCase, string-id documents). Campaign titles are joined onto
 * each donation in memory. Bounded lists for the tables; true counts for
 * the summary cards. */
export function getDonationOverview(): Promise<DonationOverview> {
  return live(
    () => ({
      campaigns: [],
      donations: [],
      donors: [],
      totalRaised: 0,
      totalDonations: 0,
      activeCampaigns: 0,
      totalDonors: 0,
    }),
    async () => {
      const db = await mongo();
      const [campaignDocs, donationDocs, donorDocs, totalDonations, totalDonors] = await Promise.all([
        db.collection("campaigns").find({}).toArray(),
        db.collection("donations").find({}).sort({ createdAt: -1 }).limit(25).toArray(),
        db.collection("public_donors").find({}).sort({ totalDonated: -1 }).limit(10).toArray(),
        db.collection("donations").countDocuments(),
        db.collection("public_donors").countDocuments(),
      ]);

      const titleById = new Map(campaignDocs.map((c) => [s(c.id ?? c._id), s(c.title)]));
      const campaigns = campaignDocs
        .map((c) => ({
          id: s(c.id ?? c._id),
          title: s(c.title) || "—",
          category: s(c.category),
          location: s(c.location),
          goalAmount: n(c.goalAmount),
          raisedAmount: n(c.raisedAmount),
          donorCount: n(c.donorCount),
          currency: s(c.currency) || "PKR",
          status: (s(c.status) || "active") as CampaignStatus,
          endsAt: s(c.endsAt),
        }))
        .sort((a, b) => b.raisedAmount - a.raisedAmount);

      const donations = donationDocs.map((d) => ({
        id: s(d.id ?? d._id),
        campaignId: s(d.campaignId),
        campaignTitle: titleById.get(s(d.campaignId)) ?? "—",
        donorName: d.isAnonymous ? "Anonymous" : s(d.donorName) || "—",
        amount: n(d.amount),
        currency: s(d.currency) || "PKR",
        isAnonymous: Boolean(d.isAnonymous),
        message: d.message ? s(d.message) : undefined,
        createdAt: s(d.createdAt),
      }));

      const donors = donorDocs.map((u) => ({
        id: s(u.id ?? u._id),
        name: s(u.name) || "—",
        email: s(u.email),
        totalDonated: n(u.totalDonated),
        donationCount: n(u.donationCount),
        memberSince: s(u.memberSince),
      }));

      const totalRaised = campaigns.reduce((sum, c) => sum + c.raisedAmount, 0);
      const activeCampaigns = campaigns.filter((c) => c.status !== "completed").length;
      return { campaigns, donations, donors, totalRaised, totalDonations, activeCampaigns, totalDonors };
    },
  );
}

/** One campaign's full page content plus every donation it has received. */
export function getCampaignDetail(id: string): Promise<CampaignDetail | undefined> {
  return live(
    () => undefined,
    async () => {
      const db = await mongo();
      // Campaign ids are short strings ("c1"), not ObjectIds — hence the cast.
      const doc = await db
        .collection("campaigns")
        .findOne({ $or: [{ id }, { _id: id }] } as Doc);
      if (!doc) return undefined;

      const campaignId = s(doc.id ?? doc._id);
      const donationDocs = await db
        .collection("donations")
        .find({ campaignId })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return {
        id: campaignId,
        title: s(doc.title) || "—",
        category: s(doc.category),
        location: s(doc.location),
        goalAmount: n(doc.goalAmount),
        raisedAmount: n(doc.raisedAmount),
        donorCount: n(doc.donorCount),
        currency: s(doc.currency) || "PKR",
        status: (s(doc.status) || "active") as CampaignStatus,
        endsAt: s(doc.endsAt),
        slug: s(doc.slug),
        tagline: s(doc.tagline),
        description: s(doc.description),
        story: (Array.isArray(doc.story) ? doc.story : []).map(s).filter(Boolean),
        imageUrl: s(doc.imageUrl),
        gallery: (Array.isArray(doc.gallery) ? doc.gallery : []).map(s).filter(Boolean),
        createdAt: s(doc.createdAt),
        donations: donationDocs.map((d) => ({
          id: s(d.id ?? d._id),
          campaignId,
          campaignTitle: s(doc.title),
          donorName: d.isAnonymous ? "Anonymous" : s(d.donorName) || "—",
          amount: n(d.amount),
          currency: s(d.currency) || "PKR",
          isAnonymous: Boolean(d.isAnonymous),
          message: d.message ? s(d.message) : undefined,
          createdAt: s(d.createdAt),
        })),
      };
    },
  );
}

/**
 * One donor's full profile plus every donation they've made. Donations link
 * to donors only by `donorName` in this data (there is no donorId foreign
 * key), so we match on the name — imperfect if two donors share a name, but
 * it's the only linkage the source records provide, and the donor's own
 * stored totalDonated/donationCount stay the authoritative headline figures.
 */
export function getDonorById(id: string): Promise<DonorDetail | undefined> {
  return live(
    () => undefined,
    async () => {
      const db = await mongo();
      // Donor ids are short strings ("u2"), not ObjectIds — hence the cast.
      const doc = await db
        .collection("public_donors")
        .findOne({ $or: [{ id }, { _id: id }] } as Doc);
      if (!doc) return undefined;

      const name = s(doc.name) || "—";
      const [campaignDocs, donationDocs] = await Promise.all([
        db.collection("campaigns").find({}, { projection: { id: 1, _id: 1, title: 1 } }).toArray(),
        db.collection("donations").find({ donorName: name }).sort({ createdAt: -1 }).limit(50).toArray(),
      ]);
      const titleById = new Map(campaignDocs.map((c) => [s(c.id ?? c._id), s(c.title)]));

      const donations = donationDocs.map((d) => ({
        id: s(d.id ?? d._id),
        campaignId: s(d.campaignId),
        campaignTitle: titleById.get(s(d.campaignId)) ?? "—",
        donorName: d.isAnonymous ? "Anonymous" : s(d.donorName) || "—",
        amount: n(d.amount),
        currency: s(d.currency) || "PKR",
        isAnonymous: Boolean(d.isAnonymous),
        message: d.message ? s(d.message) : undefined,
        createdAt: s(d.createdAt),
      }));

      return {
        id: s(doc.id ?? doc._id),
        name,
        email: s(doc.email),
        phone: doc.phone ? s(doc.phone) : undefined,
        totalDonated: n(doc.totalDonated),
        donationCount: n(doc.donationCount),
        memberSince: s(doc.memberSince),
        donations,
        campaignCount: new Set(donations.map((d) => d.campaignId)).size,
      };
    },
  );
}

/* ── student fee payments ──────────────────────────────────────
 * Reads the `payments` collection (Blinq/1Bill invoices). The `status`
 * field is dirty in the real data ("paid", "paida", "pa\naid", "pending"),
 * so we normalise it: anything starting "pen" is pending, anything starting
 * "pa" is paid, else pending (conservative — never inflates "collected").
 * Only 106 docs, so we fetch all, compute exact totals, and slice for the
 * table — cheaper and more correct than aggregating over the messy field. */
function normalizePaymentStatus(raw: string): PaymentStatus {
  const v = raw.replace(/\s/g, "").toLowerCase();
  if (v.startsWith("pen")) return "pending";
  if (v.startsWith("pa")) return "paid";
  return "pending";
}

/** "2501" → "Jan 2025". Leaves anything unexpected untouched. */
function formatBillingMonth(ym: string): string {
  if (!/^\d{4}$/.test(ym)) return ym || "—";
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mm = Number(ym.slice(2));
  return `${months[mm] ?? mm} 20${ym.slice(0, 2)}`;
}

export function getPaymentOverview(): Promise<PaymentOverview> {
  return live(
    () => ({
      payments: [],
      totalCollected: 0,
      totalPending: 0,
      paidCount: 0,
      pendingCount: 0,
      totalInvoices: 0,
    }),
    async () => {
      const db = await mongo();
      const docs = await db.collection("payments").find({}).toArray();

      const studentIds = [...new Set(docs.map((d) => s(d.student)).filter(isHexId))];
      const stu = await db
        .collection("students")
        .find({ _id: { $in: studentIds.map((id) => new ObjectId(id)) } })
        .project({ full_name: 1 })
        .toArray();
      const nameById = new Map(stu.map((x) => [s(x._id), s(x.full_name)]));

      const all = docs.map((d) => ({
        id: s(d._id),
        studentId: s(d.student),
        studentName: nameById.get(s(d.student)) || "—",
        amount: n(d.amount),
        billingMonth: formatBillingMonth(s(d.billing_month)),
        dueDate: s(d.due_date),
        status: normalizePaymentStatus(s(d.status)),
        type: s(d.type) || "—",
        invoiceNumber: s(d.blinq_invoice_number),
      }));

      const paid = all.filter((p) => p.status === "paid");
      const totalCollected = paid.reduce((sum, p) => sum + p.amount, 0);
      const totalPending = all.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
      const payments = [...all].sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1)).slice(0, 50);

      return {
        payments,
        totalCollected,
        totalPending,
        paidCount: paid.length,
        pendingCount: all.length - paid.length,
        totalInvoices: all.length,
      };
    },
  );
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

/**
 * One trainer's complete profile: their record, every campus they're assigned
 * to, and their real check-in history from `trainer_attendances`.
 */
export function getTrainerDetail(id: string): Promise<TrainerDetail | undefined> {
  return live(
    () => undefined,
    async () => {
      if (!isHexId(id)) return undefined;
      const db = await mongo();
      const [doc, base, attRows] = await Promise.all([
        db.collection("trainers").findOne({ _id: new ObjectId(id) }),
        getTrainer(id),
        db
          .collection("trainer_attendances")
          .aggregate([
            { $match: { trainer: idMatch(id), status: { $ne: "deleted" } } },
            {
              $group: {
                _id: null,
                sessions: { $sum: 1 },
                totalMinutes: { $sum: { $ifNull: ["$minutes", 0] } },
                lateSessions: {
                  $sum: { $cond: [{ $gt: [{ $ifNull: ["$late_check_in_minutes", 0] }, 0] }, 1, 0] },
                },
                lastCheckIn: { $max: "$check_in" },
              },
            },
          ])
          .toArray(),
      ]);
      if (!doc || !base) return undefined;

      const links = Array.isArray(doc.social_links) ? (doc.social_links as Doc[]) : [];
      return {
        ...base,
        image: s(doc.image) || undefined,
        phone: s(doc.phone_number),
        description: s(doc.description),
        employeeId: s(doc.employee_id),
        socialLinks: links
          .map((l) => ({ name: s(l.name), url: s(l.url) }))
          .filter((l) => l.name && l.url),
        campusIds: (Array.isArray(doc.campus) ? doc.campus : [doc.campus]).filter(Boolean).map(s),
        sessions: n(attRows[0]?.sessions),
        totalMinutes: n(attRows[0]?.totalMinutes),
        lateSessions: n(attRows[0]?.lateSessions),
        lastCheckIn: s(attRows[0]?.lastCheckIn),
      };
    },
  );
}

/* ── courses (from `new_courses` offerings) ────────────────── */
async function loadCourses(): Promise<Course[]> {
  const db = await mongo();
  const [docs, maps, byEnrol, bySlot] = await Promise.all([
    db.collection("new_courses").find({}).toArray(),
    nameMaps(),
    db.collection("student_inductions").aggregate([
      { $match: { new_course: { $ne: null } } },
      { $group: { _id: "$new_course", n: { $sum: 1 } } },
    ]).toArray(),
    // A course offering's trainer isn't stored on the offering itself —
    // it lives on the class slots teaching it.
    db.collection("slots").aggregate([
      { $match: { new_course: { $ne: null }, trainer: { $ne: null } } },
      { $group: { _id: "$new_course", trainer: { $first: "$trainer" } } },
    ]).toArray(),
  ]);
  const enrolled: Record<string, number> = {};
  for (const r of byEnrol) enrolled[s(r._id)] = n(r.n);
  const slotTrainer: Record<string, string> = {};
  for (const r of bySlot) slotTrainer[s(r._id)] = s(r.trainer);
  return docs.map((d) => {
    const id = s(d._id);
    const campuses = Array.isArray(d.campuses) ? d.campuses : [];
    // "2 months" → 2; unparseable/absent stays 0 (UI shows "—").
    const duration = parseInt(maps.courseDuration[s(d.course)] ?? "", 10);
    return {
      id,
      name: maps.courseName[s(d.course)] || `Batch ${n(d.batch_number)}`,
      campusId: campuses.length ? s(campuses[0]) : "",
      trainerId: slotTrainer[id] ?? "",
      status: (d.status === true ? "running" : "completed") as Course["status"],
      enrolledCount: enrolled[id] ?? 0,
      progressPercent: 0,
      durationMonths: Number.isFinite(duration) ? duration : 0,
      startedAt: yearOf(d.createdAt),
    };
  });
}

export function getCourses(): Promise<Course[]> {
  return live(mock.getCourses, loadCourses);
}

/**
 * One course offering's complete detail: the batch (`new_courses`) joined to
 * its catalog entry (`courses`), which is where the description, outline, and
 * cover image live.
 */
export function getCourseDetail(id: string): Promise<CourseDetail | undefined> {
  return live(
    () => undefined,
    async () => {
      if (!isHexId(id)) return undefined;
      const db = await mongo();
      const [offering, base] = await Promise.all([
        db.collection("new_courses").findOne({ _id: new ObjectId(id) }),
        (await loadCourses()).find((c) => c.id === id),
      ]);
      if (!offering || !base) return undefined;

      const catalog = offering.course
        ? await db.collection("courses").findOne({ _id: offering.course })
        : null;
      const en: Doc = catalog?.en ?? {};
      const categoryId = s(en.course_category);
      const categoryDoc = categoryId && isHexId(categoryId)
        ? await db.collection("course_categories").findOne({ _id: new ObjectId(categoryId) })
        : null;

      return {
        ...base,
        coverImage: s(catalog?.cover_image) || undefined,
        category: s(categoryDoc?.en?.category_name) || s(categoryDoc?.en?.name) || "—",
        durationText: s(en.course_duration),
        description: s(en.description),
        outline: (Array.isArray(en.outline) ? en.outline : []).map(s).filter(Boolean),
        instructions: (Array.isArray(offering.instruction) ? offering.instruction : []).map(s).filter(Boolean),
        batchNumber: n(offering.batch_number),
        fees: n(offering.fees),
        gender: (Array.isArray(offering.gender?.en) ? offering.gender.en : []).map(s).filter(Boolean),
        campusIds: (Array.isArray(offering.campuses) ? offering.campuses : []).filter(Boolean).map(s),
      };
    },
  );
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

/* ── chart series ──────────────────────────────────────────────
 * Bucketed aggregates for the dashboard charts. Each is built directly from
 * the real collections and only spans the months the data itself covers —
 * we never pad the ends with invented zeros to make a trend look longer. */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2501" (YYMM, the billing_month format) → axis + tooltip labels. */
function labelsFromYYMM(ym: string) {
  const mi = Number(ym.slice(2)) - 1;
  const yy = ym.slice(0, 2);
  if (mi < 0 || mi > 11) return { label: ym, fullLabel: ym };
  return { label: `${MONTH_SHORT[mi]} ${yy}`, fullLabel: `${MONTH_LONG[mi]} 20${yy}` };
}

/** "2025-02" ($dateToString %Y-%m) → axis + tooltip labels. */
function labelsFromISOMonth(ym: string) {
  const [y, m] = ym.split("-");
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return { label: ym, fullLabel: ym };
  return { label: `${MONTH_SHORT[mi]} ${y.slice(2)}`, fullLabel: `${MONTH_LONG[mi]} ${y}` };
}

/**
 * Fee billing per month, split into collected vs still outstanding.
 * Grouped in memory because `payments.status` is dirty in the real data
 * (see normalizePaymentStatus) — a $group on the raw field would mis-bucket.
 */
export function getFeeTrend(): Promise<FeeTrendPoint[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const docs = await db
        .collection("payments")
        .find({}, { projection: { billing_month: 1, amount: 1, status: 1 } })
        .toArray();

      const byMonth = new Map<string, { collected: number; outstanding: number }>();
      for (const d of docs) {
        const ym = s(d.billing_month);
        if (!/^\d{4}$/.test(ym)) continue;
        const bucket = byMonth.get(ym) ?? { collected: 0, outstanding: 0 };
        if (normalizePaymentStatus(s(d.status)) === "paid") bucket.collected += n(d.amount);
        else bucket.outstanding += n(d.amount);
        byMonth.set(ym, bucket);
      }
      return [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ym, v]) => ({ ...labelsFromYYMM(ym), ...v }));
    },
  );
}

/** New enrolments per month, from each induction's creation date. */
export function getEnrolmentTrend(): Promise<TrendPoint[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const rows = await db
        .collection("student_inductions")
        .aggregate([
          { $match: { createdAt: { $ne: null } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }, n: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ])
        .toArray();
      return rows.map((r) => ({ ...labelsFromISOMonth(s(r._id)), value: n(r.n) }));
    },
  );
}

/**
 * New enrolments vs dropouts, aligned to the same monthly buckets (any month
 * either series touches, zero-filled for the other). dropout_date is stored
 * as a mix of real Dates and ISO strings across records — $convert with
 * onError/onNull keeps a bad value from failing the whole aggregation
 * instead of just being excluded, same approach as the AI agent's
 * analyze_enrolments tool.
 */
export function getEnrolmentVsDropoutTrend(): Promise<DualTrendPoint[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const [enrolRows, dropoutRows] = await Promise.all([
        db
          .collection("student_inductions")
          .aggregate([
            { $match: { createdAt: { $ne: null } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }, n: { $sum: 1 } } },
          ])
          .toArray(),
        db
          .collection("student_inductions")
          .aggregate([
            { $match: { dropout_date: { $ne: null } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m",
                    date: { $convert: { input: "$dropout_date", to: "date", onError: null, onNull: null } },
                  },
                },
                n: { $sum: 1 },
              },
            },
          ])
          .toArray(),
      ]);
      const enrolMap = new Map(enrolRows.map((r) => [s(r._id), n(r.n)]));
      const dropoutMap = new Map(dropoutRows.map((r) => [s(r._id), n(r.n)]));
      const months = [...new Set([...enrolMap.keys(), ...dropoutMap.keys()])].filter(Boolean).sort();
      return months.map((ym) => ({
        ...labelsFromISOMonth(ym),
        primary: enrolMap.get(ym) ?? 0,
        secondary: dropoutMap.get(ym) ?? 0,
      }));
    },
  );
}

/**
 * Assignment review outcomes — the real "how are submissions being
 * evaluated" picture, from `assignment_submissions.status`. "submitted" and
 * "late_submitted" both mean the trainer hasn't acted on it yet, so both
 * fold into "Unreviewed".
 */
export function getAssessmentPerformance(): Promise<BreakdownSlice[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const rows = await db
        .collection("assignment_submissions")
        .aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])
        .toArray();
      const byStatus = new Map(rows.map((r) => [s(r._id).toLowerCase(), n(r.n)]));
      return [
        { label: "Approved", value: byStatus.get("approved") ?? 0 },
        { label: "Unreviewed", value: (byStatus.get("submitted") ?? 0) + (byStatus.get("late_submitted") ?? 0) },
        { label: "Rejected", value: byStatus.get("not_approved") ?? 0 },
      ];
    },
  );
}

/**
 * Job-placement status values, IF this system ever starts recording them.
 * None of the training system's real enrolment statuses currently include
 * any of these — job placements are not tracked anywhere in the database —
 * which is why getEmploymentTrend/getJobPlacementsByCourse below correctly
 * return empty right now. Both queries run against student_inductions.status
 * directly, so the moment a real record's status is ever set to one of
 * these, they start reporting it automatically — no code change needed.
 */
const PLACEMENT_STATUSES = ["placed", "hired", "employed"];

/** Certified students vs. job placements, per month. Empty until placement
 *  data exists — see PLACEMENT_STATUSES above. */
export function getEmploymentTrend(): Promise<DualTrendPoint[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const [certifiedRows, placedRows] = await Promise.all([
        db
          .collection("student_inductions")
          .aggregate([
            { $match: { status: { $in: ["passed", "completed"] }, createdAt: { $ne: null } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }, n: { $sum: 1 } } },
          ])
          .toArray(),
        db
          .collection("student_inductions")
          .aggregate([
            { $match: { status: { $in: PLACEMENT_STATUSES }, createdAt: { $ne: null } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }, n: { $sum: 1 } } },
          ])
          .toArray(),
      ]);
      const certifiedMap = new Map(certifiedRows.map((r) => [s(r._id), n(r.n)]));
      const placedMap = new Map(placedRows.map((r) => [s(r._id), n(r.n)]));
      // Certified is real data either way. Employed stays honestly at 0 for
      // every month until a real placement exists — an actual flat line, not
      // an empty-state message; the chart itself is the honest signal here.
      const months = [...new Set([...certifiedMap.keys(), ...placedMap.keys()])].filter(Boolean).sort();
      return months.map((ym) => ({
        ...labelsFromISOMonth(ym),
        primary: certifiedMap.get(ym) ?? 0,
        secondary: placedMap.get(ym) ?? 0,
      }));
    },
  );
}

/** Job placements per course. Empty until placement data exists — see
 *  PLACEMENT_STATUSES above. */
export function getJobPlacementsByCourse(): Promise<BreakdownSlice[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const rows = await db
        .collection("student_inductions")
        .aggregate([
          { $match: { status: { $in: PLACEMENT_STATUSES } } },
          { $group: { _id: "$course", n: { $sum: 1 } } },
          { $sort: { n: -1 } },
        ])
        .toArray();
      if (rows.length === 0) return [];
      const courseName = await resolveNames("courses", rows.map((r) => s(r._id)));
      return rows.map((r) => ({ label: courseName[s(r._id)] ?? s(r._id), value: n(r.n) }));
    },
  );
}

/** Class check-ins per month, from the real `attendances` log. */
export function getAttendanceTrend(): Promise<TrendPoint[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const rows = await db
        .collection("attendances")
        .aggregate([
          { $match: { time_stamp: { $ne: null } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$time_stamp" } } }, n: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ])
        .toArray();
      return rows.map((r) => ({ ...labelsFromISOMonth(s(r._id)), value: n(r.n) }));
    },
  );
}

/**
 * Enrolments broken down by the training system's REAL status values
 * (enrolled / pending / passed / completed / dropout / …) — richer and more
 * honest than the active-vs-inactive binary the list pages derive.
 */
export function getEnrolmentStatusBreakdown(): Promise<BreakdownSlice[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const rows = await db
        .collection("student_inductions")
        .aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }, { $sort: { n: -1 } }])
        .toArray();
      return rows.map((r) => {
        const raw = s(r._id) || "unknown";
        return { label: raw.charAt(0).toUpperCase() + raw.slice(1), value: n(r.n) };
      });
    },
  );
}

/** Which of the 7 real enrolment statuses count as "still enrolled",
 *  "certified", or "left the pipeline" — same active/graduated split already
 *  used for the student list's derived enrollment/placement flags. */
const ENROLMENT_BUCKETS: Array<{ label: string; statuses: string[] }> = [
  { label: "Enrolled", statuses: ["enrolled", "pending"] },
  { label: "Certified", statuses: ["passed", "completed"] },
  { label: "Dropout", statuses: ["dropout", "rejected", "blacklisted"] },
];

/**
 * Rolls the training system's 7 real enrolment statuses (from
 * getEnrolmentStatusBreakdown) into the 3 groups a summary donut can show at
 * a glance. "Dropout" here covers every way a student left the pipeline —
 * dropped out, was rejected, or was blacklisted — a simplification made for
 * the headline chart; the exact status-by-status counts are still there in
 * the full breakdown, one click away in the chart's table view.
 */
export function summarizeEnrolmentBuckets(breakdown: BreakdownSlice[]): BreakdownSlice[] {
  return ENROLMENT_BUCKETS.map(({ label, statuses }) => ({
    label,
    value: breakdown
      .filter((b) => statuses.includes(b.label.toLowerCase()))
      .reduce((sum, b) => sum + b.value, 0),
  }));
}

/**
 * How many students are enrolled on each course in the catalog.
 *
 * Every catalog course is returned, including those nobody has enrolled on —
 * a zero is a real, useful answer here ("this course isn't drawing anyone"),
 * and dropping it would quietly overstate the catalog's reach.
 */
export function getCourseEnrolment(): Promise<BreakdownSlice[]> {
  return live(
    () => [],
    async () => {
      const db = await mongo();
      const [counts, courses] = await Promise.all([
        db
          .collection("student_inductions")
          .aggregate([{ $group: { _id: "$course", n: { $sum: 1 } } }])
          .toArray(),
        db.collection("courses").find({}, { projection: { "en.course_name": 1 } }).toArray(),
      ]);
      const byCourse = new Map(counts.map((c) => [s(c._id), n(c.n)]));
      // The catalog holds more than one record under the same name (two
      // separate "Artificial Intelligence and Data Science" rows). Roll them
      // up by name: "how many students are on this course" is one number, and
      // two identically-labelled bars would just read as a rendering bug.
      // Names also carry stray tabs/whitespace in the source data.
      const byName = new Map<string, number>();
      for (const c of courses) {
        const label = (s(c.en?.course_name) || "Untitled course").trim();
        byName.set(label, (byName.get(label) ?? 0) + (byCourse.get(s(c._id)) ?? 0));
      }
      return [...byName.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    },
  );
}

/** Everything the "Export to sheet" button (Sponsorship Impact Report)
 *  needs, scoped to one campus — or every campus when `campusId` is null. */
export interface SponsorshipReportData {
  campusName: string;
  generatedAt: string;
  generatedBy: string;
  totalStudents: number;
  activeClasses: number;
  coursesRunning: number;
  trainersOnboard: number;
  enrolmentBreakdown: BreakdownSlice[];
  assessmentPerformance: BreakdownSlice[];
  courseEnrolment: BreakdownSlice[];
  jobPlacements: BreakdownSlice[];
  enrolmentOverTime: DualTrendPoint[];
  employmentTrend: DualTrendPoint[];
}

export async function getSponsorshipReportData(
  campusId: string | null,
  generatedBy: string,
): Promise<SponsorshipReportData> {
  const db = await mongo();
  const inductionMatch: Record<string, unknown> = {};
  if (campusId) inductionMatch.campus = idMatch(campusId);

  const [
    campusDoc,
    totalStudents,
    activeClasses,
    coursesRunning,
    trainersOnboard,
    statusRows,
    assessmentRows,
    courseRows,
    courseCatalog,
    placementCourseRows,
    enrolRows,
    dropoutRows,
    certifiedRows,
    placedRows,
  ] = await Promise.all([
    campusId ? db.collection("campus").findOne({ _id: idMatch(campusId) } as Doc, { projection: { en: 1 } }) : null,
    db.collection("student_inductions").countDocuments(inductionMatch),
    db
      .collection("slots")
      // No status filter — matches getOrgStats' own "Active classes" stat
      // card exactly (an all-slots count), so the report never disagrees
      // with the live dashboard for the same scope.
      .countDocuments(campusId ? { campus: idMatch(campusId) } : {}),
    db
      .collection("new_courses")
      .countDocuments(campusId ? { campuses: idMatch(campusId), status: true } : { status: true }),
    db.collection("trainers").countDocuments(campusId ? { campus: idMatch(campusId) } : {}),
    db
      .collection("student_inductions")
      .aggregate([{ $match: inductionMatch }, { $group: { _id: "$status", n: { $sum: 1 } } }])
      .toArray(),
    // assignment_submissions has no campus field of its own — join through
    // the enrolment it belongs to, same as getAssessmentPerformance but with
    // the campus filter applied on the joined side.
    db
      .collection("assignment_submissions")
      .aggregate([
        { $lookup: { from: "student_inductions", localField: "student_induction", foreignField: "_id", as: "ind" } },
        { $unwind: { path: "$ind", preserveNullAndEmptyArrays: true } },
        ...(campusId ? [{ $match: { "ind.campus": idMatch(campusId) } }] : []),
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("student_inductions")
      .aggregate([{ $match: inductionMatch }, { $group: { _id: "$course", n: { $sum: 1 } } }])
      .toArray(),
    db.collection("courses").find({}, { projection: { "en.course_name": 1 } }).toArray(),
    db
      .collection("student_inductions")
      .aggregate([
        { $match: { ...inductionMatch, status: { $in: PLACEMENT_STATUSES } } },
        { $group: { _id: "$course", n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("student_inductions")
      .aggregate([
        { $match: { ...inductionMatch, createdAt: { $ne: null } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("student_inductions")
      .aggregate([
        { $match: { ...inductionMatch, dropout_date: { $ne: null } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m",
                date: { $convert: { input: "$dropout_date", to: "date", onError: null, onNull: null } },
              },
            },
            n: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    db
      .collection("student_inductions")
      .aggregate([
        { $match: { ...inductionMatch, status: { $in: ["passed", "completed"] }, createdAt: { $ne: null } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("student_inductions")
      .aggregate([
        { $match: { ...inductionMatch, status: { $in: PLACEMENT_STATUSES }, createdAt: { $ne: null } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$createdAt" } } }, n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const enrolmentBreakdown = statusRows.map((r) => {
    const raw = s(r._id) || "unknown";
    return { label: raw.charAt(0).toUpperCase() + raw.slice(1), value: n(r.n) };
  });

  const assessByStatus = new Map(assessmentRows.map((r) => [s(r._id).toLowerCase(), n(r.n)]));
  const assessmentPerformance = [
    { label: "Approved", value: assessByStatus.get("approved") ?? 0 },
    { label: "Unreviewed", value: (assessByStatus.get("submitted") ?? 0) + (assessByStatus.get("late_submitted") ?? 0) },
    { label: "Rejected", value: assessByStatus.get("not_approved") ?? 0 },
  ];

  const courseNameByName = new Map<string, number>();
  const catalogNames = new Map(courseCatalog.map((c) => [s(c._id), (s(c.en?.course_name) || "Untitled course").trim()]));
  const byCourseCount = new Map(courseRows.map((r) => [s(r._id), n(r.n)]));
  for (const [id, name] of catalogNames) {
    courseNameByName.set(name, (courseNameByName.get(name) ?? 0) + (byCourseCount.get(id) ?? 0));
  }
  const courseEnrolment = [...courseNameByName.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const jobPlacements =
    placementCourseRows.length === 0
      ? []
      : placementCourseRows
          .map((r) => ({ label: catalogNames.get(s(r._id)) ?? s(r._id), value: n(r.n) }))
          .sort((a, b) => b.value - a.value);

  const enrolMap = new Map(enrolRows.map((r) => [s(r._id), n(r.n)]));
  const dropoutMap = new Map(dropoutRows.map((r) => [s(r._id), n(r.n)]));
  const trendMonths = [...new Set([...enrolMap.keys(), ...dropoutMap.keys()])].filter(Boolean).sort();
  const enrolmentOverTime = trendMonths.map((ym) => ({
    ...labelsFromISOMonth(ym),
    primary: enrolMap.get(ym) ?? 0,
    secondary: dropoutMap.get(ym) ?? 0,
  }));

  const certifiedMap = new Map(certifiedRows.map((r) => [s(r._id), n(r.n)]));
  const placedMap = new Map(placedRows.map((r) => [s(r._id), n(r.n)]));
  const empMonths = [...new Set([...certifiedMap.keys(), ...placedMap.keys()])].filter(Boolean).sort();
  const employmentTrend = empMonths.map((ym) => ({
    ...labelsFromISOMonth(ym),
    primary: certifiedMap.get(ym) ?? 0,
    secondary: placedMap.get(ym) ?? 0,
  }));

  return {
    campusName: campusId ? (s(campusDoc?.en?.campus_name) || "Selected campus") : "All Campuses",
    generatedAt: new Date().toISOString(),
    generatedBy,
    totalStudents,
    activeClasses,
    coursesRunning,
    trainersOnboard,
    enrolmentBreakdown,
    assessmentPerformance,
    courseEnrolment,
    jobPlacements,
    enrolmentOverTime,
    employmentTrend,
  };
}

/**
 * The signed-in user's own account details, straight from whichever
 * collection their role authenticates against (mirrors findAccount in the
 * login route: admin → users, trainer → trainers, donor → portal_donors).
 * Session fields are the guaranteed floor; everything else appears only when
 * the account document actually records it.
 */
export function getMyProfile(session: {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "trainer" | "donor";
}): Promise<MyProfile> {
  const base: MyProfile = { name: session.name, email: session.email, role: session.role };
  return live(
    () => base,
    async () => {
      const db = await mongo();

      if (session.role === "trainer") {
        const doc = await db.collection("trainers").findOne({ _id: idMatch(session.userId) } as Doc);
        if (!doc) return base;
        const campusId = Array.isArray(doc.campus) ? s(doc.campus[0]) : s(doc.campus);
        const [campusName, courseName] = await Promise.all([
          resolveNames("campuses", [campusId]),
          resolveNames("courses", (doc.courses ?? []).map((c: unknown) => s(c))),
        ]);
        return {
          ...base,
          name: s(doc.en?.trainer_name) || base.name,
          phone: s(doc.phone_number) || undefined,
          employeeId: s(doc.employee_id) || undefined,
          hourlyRate: doc.hourly_rate != null ? n(doc.hourly_rate) : undefined,
          campusName: campusName[campusId],
          courseNames: (doc.courses ?? [])
            .map((c: unknown) => courseName[s(c)])
            .filter(Boolean) as string[],
          joinedAt: doc.createdAt ? s(doc.createdAt) : undefined,
        };
      }

      const coll = session.role === "admin" ? "users" : "portal_donors";
      const doc = await db.collection(coll).findOne({ _id: idMatch(session.userId) } as Doc);
      if (!doc) return base;
      return {
        ...base,
        name: s(doc.name) || base.name,
        sourceRole: session.role === "admin" ? s(doc.role) || undefined : undefined,
        joinedAt: doc.createdAt ? s(doc.createdAt) : undefined,
        isTestAccount: doc.isTestAccount === true || undefined,
      };
    },
  );
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
