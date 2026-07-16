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
