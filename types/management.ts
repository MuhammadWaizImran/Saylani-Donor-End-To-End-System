export type UserRole = "admin" | "donor" | "trainer";

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Plain text because this is a mock frontend — replace with real auth later. */
  password: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Campus {
  id: string;
  name: string;
  city: string;
  address: string;
  established: string;
  studentCount: number;
  trainerCount: number;
  courseCount: number;
  placementRate: number; // %
  progressPercent: number; // overall campus progress
}

export type CourseStatus = "running" | "completed" | "upcoming";

export interface Course {
  id: string;
  name: string;
  campusId: string;
  trainerId: string;
  status: CourseStatus;
  enrolledCount: number;
  progressPercent: number;
  durationMonths: number;
  startedAt: string;
}

export type EnrollmentStatus = "active" | "inactive";
export type PlacementStatus = "placed" | "seeking" | "studying";

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  campusId: string;
  courseId: string;
  trainerId: string;
  enrollmentStatus: EnrollmentStatus;
  progressPercent: number;
  attendancePercent: number;
  placementStatus: PlacementStatus;
  company?: string;
  salary?: number; // PKR / month
  placementDate?: string;
}

export interface Trainer {
  id: string;
  name: string;
  email: string;
  campusId: string;
  salary: number; // PKR / month
  specialization: string;
  studentCount: number;
  batchesCount: number;
  placedCount: number;
  performancePercent: number;
  joinedAt: string;
}

export interface ActiveClass {
  id: string;
  name: string;
  campusId: string;
  trainerId: string;
  courseId: string;
  studentCount: number;
  timing: string; // e.g. "Mon–Fri · 9:00–11:00 AM"
}

export interface SuccessStory {
  id: string;
  name: string;
  designation: string;
  photo: string;
  story: string;
  description?: string;
  video?: string;
  order: number;
  /** True for placeholder entries added while the company's real data is still empty. */
  isDemo?: boolean;
}

export interface OrgStats {
  totalCampuses: number;
  totalStudents: number;
  totalTrainers: number;
  runningCourses: number;
  activeClasses: number;
  studentsPlaced: number;
  avgPlacementSalary: number;
  avgStudentProgress: number;
  avgAttendance: number;
}

/** One student's real class-attendance record, from the `attendances`
 *  collection — only students with at least one logged class appear here. */
export interface AttendanceRecord {
  studentId: string;
  name: string;
  campusId: string;
  courseId: string;
  classesAttended: number;
  lastAttended: string;
}

export interface AttendanceOverview {
  records: AttendanceRecord[];
  /** How many students (out of totalStudents) have any logged attendance. */
  studentsTracked: number;
  totalStudents: number;
  totalClassRecords: number;
}

/** One trainer's real check-in record, from the `trainer_attendances`
 *  collection — only trainers with at least one logged session appear here. */
export interface TrainerAttendanceRecord {
  trainerId: string;
  name: string;
  /** Non-deleted check-in sessions on record. */
  sessions: number;
  /** Total minutes present across all sessions. */
  totalMinutes: number;
  /** Sessions that were flagged as a late check-in. */
  lateSessions: number;
  lastCheckIn: string;
}

export interface TrainerAttendanceOverview {
  records: TrainerAttendanceRecord[];
  /** How many trainers (out of totalTrainers) have any logged session. */
  trainersTracked: number;
  totalTrainers: number;
  totalSessions: number;
  totalMinutes: number;
}

/* ── Fundraising: campaigns / donations / donors ──────────────
 * From the `campaigns`, `donations`, and `public_donors` collections.
 * Read live from MongoDB. NOTE: this data is currently seeded sample
 * data (string ids c1/d1/u1, placeholder imagery) — the fundraising side
 * is not yet wired to real giving, unlike the student `payments` below. */
export type CampaignStatus = "active" | "urgent" | "completed";

export interface Campaign {
  id: string;
  title: string;
  category: string;
  location: string;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  currency: string;
  status: CampaignStatus;
  endsAt: string;
}

export interface Donation {
  id: string;
  campaignId: string;
  campaignTitle: string;
  donorName: string;
  amount: number;
  currency: string;
  isAnonymous: boolean;
  message?: string;
  createdAt: string;
}

export interface PublicDonor {
  id: string;
  name: string;
  email: string;
  totalDonated: number;
  donationCount: number;
  memberSince: string;
}

export interface DonationOverview {
  campaigns: Campaign[];
  /** Most recent donations (bounded). */
  donations: Donation[];
  /** Top donors by lifetime giving (bounded). */
  donors: PublicDonor[];
  totalRaised: number;
  totalDonations: number;
  activeCampaigns: number;
  totalDonors: number;
}

/* ── Student fee payments (real operational data) ─────────────
 * From the `payments` collection — Blinq/1Bill monthly fee invoices. */
export type PaymentStatus = "paid" | "pending";

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  billingMonth: string; // human-readable, e.g. "Jan 2025"
  dueDate: string;
  status: PaymentStatus;
  type: string; // e.g. "monthly"
  invoiceNumber: string;
}

export interface PaymentOverview {
  /** Most recent invoices (bounded). */
  payments: Payment[];
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  totalInvoices: number;
}
