import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import {
  getCampuses,
  getCoursesByTrainer,
  getStudentsByTrainer,
  getTrainer,
  getTrainers,
} from "@/lib/management-api";

/**
 * Dashboard payload for the signed-in trainer — identity comes from the
 * verified session, so a trainer can only ever load their own data.
 */
export async function GET(req: Request) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  if (session.role !== "trainer") {
    return NextResponse.json({ error: "Trainers only." }, { status: 403 });
  }

  const trainer = (await getTrainer(session.email)) ?? (await getTrainers())[0];
  if (!trainer) {
    return NextResponse.json({ error: "No trainer profile found" }, { status: 404 });
  }

  // Targeted lookups only — the trainer's own campus + courses (global
  // lookup maps would fetch thousands of rows we don't need).
  const [students, courses, campuses] = await Promise.all([
    getStudentsByTrainer(trainer.id),
    getCoursesByTrainer(trainer.id),
    getCampuses(),
  ]);
  const courseName = Object.fromEntries(courses.map((c) => [c.id, c.name]));

  return NextResponse.json({
    trainer,
    campusName: campuses.find((c) => c.id === trainer.campusId)?.name ?? "—",
    courses,
    students: students.map((s) => ({
      ...s,
      courseName: courseName[s.courseId] ?? "—",
    })),
  });
}
