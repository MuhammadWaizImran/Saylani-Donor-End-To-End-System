/**
 * Client-safe, synchronous reads over the bundled mock data.
 *
 * Used ONLY as the offline fallback (mock-brain, network-failure paths).
 * Live code uses lib/management-api.ts, which queries MongoDB.
 */
import type {
  ActiveClass,
  Campus,
  Course,
  OrgStats,
  Student,
  Trainer,
} from "@/types/management";
import {
  activeClasses,
  campuses,
  courses,
  students,
  trainers,
} from "@/lib/mock-data/management";

export function getCampuses(): Campus[] {
  return campuses;
}

export function getStudents(): Student[] {
  return students;
}

export function getTrainers(): Trainer[] {
  return trainers;
}

export function getTrainer(idOrEmail: string): Trainer | undefined {
  return trainers.find((t) => t.id === idOrEmail || t.email === idOrEmail);
}

export function getCourses(): Course[] {
  return courses;
}

export function getActiveClasses(): ActiveClass[] {
  return activeClasses;
}

export function getPlacedStudents(): Student[] {
  return students
    .filter((s) => s.placementStatus === "placed")
    .sort((a, b) => (b.placementDate ?? "").localeCompare(a.placementDate ?? ""));
}

export function getStudentsByTrainer(trainerId: string): Student[] {
  return students.filter((s) => s.trainerId === trainerId);
}

export function getCoursesByTrainer(trainerId: string): Course[] {
  return courses.filter((c) => c.trainerId === trainerId);
}

export function getOrgStats(): OrgStats {
  const placed = getPlacedStudents();
  const activeStudents = students.filter((s) => s.enrollmentStatus === "active");
  const avg = (values: number[]) =>
    values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return {
    totalCampuses: campuses.length,
    totalStudents: campuses.reduce((sum, c) => sum + c.studentCount, 0),
    totalTrainers: campuses.reduce((sum, c) => sum + c.trainerCount, 0),
    runningCourses: courses.filter((c) => c.status === "running").length,
    activeClasses: activeClasses.length,
    studentsPlaced: trainers.reduce((sum, t) => sum + t.placedCount, 0),
    avgPlacementSalary: avg(placed.map((s) => s.salary ?? 0)),
    avgStudentProgress: avg(activeStudents.map((s) => s.progressPercent)),
    avgAttendance: avg(activeStudents.map((s) => s.attendancePercent)),
  };
}

export const campusName = (id: string) => campuses.find((c) => c.id === id)?.name ?? "—";
export const trainerName = (id: string) => trainers.find((t) => t.id === id)?.name ?? "—";
export const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";
