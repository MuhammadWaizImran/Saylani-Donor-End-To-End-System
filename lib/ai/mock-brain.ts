/**
 * Fallback "brain" used when GROQ_API_KEY is not configured (or Groq is
 * unreachable) — answers common questions directly from portal data so the
 * assistant is always functional.
 */
import type { UserRole } from "@/types/management";
import {
  campusName,
  courseName,
  getActiveClasses,
  getCampuses,
  getCourses,
  getOrgStats,
  getPlacedStudents,
  getStudentsByTrainer,
  getTrainer,
  getTrainers,
} from "@/lib/management-mock";
import { formatCurrency } from "@/lib/utils";

export interface AgentContext {
  role: Extract<UserRole, "admin" | "trainer">;
  userName: string;
  userEmail: string;
}

export function mockBrain(question: string, ctx: AgentContext): string {
  const q = question.toLowerCase();
  const stats = getOrgStats();

  if (ctx.role === "trainer") {
    const trainer = getTrainer(ctx.userEmail) ?? getTrainers()[0];
    const students = getStudentsByTrainer(trainer.id);
    const placed = students.filter((s) => s.placementStatus === "placed");
    const atRisk = students.filter((s) => s.attendancePercent < 60 && s.enrollmentStatus === "active");

    if (q.includes("risk") || q.includes("attendance") || q.includes("dropout")) {
      if (atRisk.length === 0)
        return `Good news, ${ctx.userName.split(" ")[0]} — none of your active students are currently below the 60% attendance threshold. Your batch average looks healthy. Keep an eye on anyone dipping under 75% though; early nudges work best.`;
      return [
        `I found ${atRisk.length} student(s) in your batches who need attention:`,
        ...atRisk.map((s) => `• ${s.name} — ${s.attendancePercent}% attendance, ${s.progressPercent}% course progress (${courseName(s.courseId)})`),
        ``,
        `Recommendation: a personal check-in call usually recovers students at this stage.`,
      ].join("\n");
    }
    if (q.includes("placement") || q.includes("job") || q.includes("salary")) {
      return [
        `Here's your placement snapshot:`,
        `• Career-track placements credited to you: ${trainer.placedCount}`,
        `• From your current sample cohort: ${placed.length} placed`,
        ...placed.map((s) => `   – ${s.name} → ${s.company} at ${formatCurrency(s.salary ?? 0)}/month`),
        ``,
        `Your placement record is a big part of your ${trainer.performancePercent}% performance score.`,
      ].join("\n");
    }
    if (q.includes("student") || q.includes("progress") || q.includes("batch")) {
      const avgProgress = Math.round(students.reduce((a, s) => a + s.progressPercent, 0) / Math.max(1, students.length));
      return [
        `Your teaching snapshot at ${campusName(trainer.campusId)}:`,
        `• Active students: ${trainer.studentCount} (sample cohort: ${students.length} profiles)`,
        `• Average progress across your cohort: ${avgProgress}%`,
        `• Batches conducted to date: ${trainer.batchesCount}`,
        `• Courses you're running: ${getCourses().filter((c) => c.trainerId === trainer.id && c.status === "running").map((c) => c.name).join(", ") || "—"}`,
      ].join("\n");
    }
    return [
      `Assalam-o-Alaikum ${ctx.userName.split(" ")[0]}! I'm your teaching copilot. Try:`,
      `• "Which of my students are at risk?"`,
      `• "Show my placement record"`,
      `• "Summarize my batches"`,
      ``,
      `(Running in offline mode — add GROQ_API_KEY to .env.local for live AI reasoning.)`,
    ].join("\n");
  }

  // ---- Admin ----
  if (q.includes("campus")) {
    const campuses = getCampuses();
    const best = [...campuses].sort((a, b) => b.progressPercent - a.progressPercent)[0];
    const weakest = [...campuses].sort((a, b) => a.progressPercent - b.progressPercent)[0];
    return [
      `Campus analysis across ${campuses.length} locations:`,
      ...campuses.map((c) => `• ${c.name} (${c.city}) — ${c.studentCount.toLocaleString()} students, ${c.progressPercent}% progress, ${c.placementRate}% placement`),
      ``,
      `📈 Strongest: ${best.name} at ${best.progressPercent}%.`,
      `⚠️ Needs attention: ${weakest.name} at ${weakest.progressPercent}%.`,
    ].join("\n");
  }
  if (q.includes("placement") || q.includes("job") || q.includes("salary") || q.includes("hire")) {
    const placed = getPlacedStudents();
    const top = placed[0] ? [...placed].sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))[0] : null;
    return [
      `Placement intelligence:`,
      `• Total careers launched (all-time): ${stats.studentsPlaced.toLocaleString()}`,
      `• Average package: ${formatCurrency(stats.avgPlacementSalary)}/month`,
      top ? `• Highest recent package: ${top.name} → ${top.company} at ${formatCurrency(top.salary ?? 0)}/month` : "",
      `• Recent placements in the sample cohort: ${placed.length}`,
    ].filter(Boolean).join("\n");
  }
  if (q.includes("trainer")) {
    const trainers = getTrainers();
    const top = [...trainers].sort((a, b) => b.performancePercent - a.performancePercent)[0];
    return [
      `Trainer overview — ${stats.totalTrainers} on staff (${trainers.length} profiled):`,
      ...trainers.slice(0, 5).map((t) => `• ${t.name} (${campusName(t.campusId)}) — ${t.performancePercent}% performance, ${t.placedCount} students placed`),
      ``,
      `🏆 Top performer: ${top.name} — ${top.placedCount} placements across ${top.batchesCount} batches.`,
    ].join("\n");
  }
  if (q.includes("course") || q.includes("class")) {
    const running = getCourses().filter((c) => c.status === "running");
    return [
      `Currently running: ${running.length} courses, ${getActiveClasses().length} live class sections.`,
      ...running.map((c) => `• ${c.name} @ ${campusName(c.campusId)} — ${c.enrolledCount} enrolled, ${c.progressPercent}% complete`),
    ].join("\n");
  }
  if (q.includes("student")) {
    return [
      `Student body overview:`,
      `• Total students in training: ${stats.totalStudents.toLocaleString()} across ${stats.totalCampuses} campuses`,
      `• Average course progress: ${stats.avgStudentProgress}%`,
      `• Average attendance: ${stats.avgAttendance}%`,
      `• Currently placed from tracked cohorts: ${stats.studentsPlaced.toLocaleString()}`,
    ].join("\n");
  }
  if (q.includes("report") || q.includes("summary") || q.includes("overview") || q.includes("advice")) {
    return [
      `Executive summary — Saylani at a glance:`,
      `• ${stats.totalCampuses} campuses · ${stats.totalStudents.toLocaleString()} students · ${stats.totalTrainers} trainers`,
      `• ${stats.runningCourses} running courses, ${stats.activeClasses} active class sections`,
      `• ${stats.studentsPlaced.toLocaleString()} careers launched, avg ${formatCurrency(stats.avgPlacementSalary)}/month`,
      `• Student health: ${stats.avgStudentProgress}% avg progress, ${stats.avgAttendance}% attendance`,
    ].join("\n");
  }
  return [
    `Assalam-o-Alaikum ${ctx.userName.split(" ")[0]}! I'm Saylani Intelligence, your operations copilot. Try asking:`,
    `• "Give me an executive summary"`,
    `• "Which campus needs attention?"`,
    `• "Show placement and salary stats"`,
    `• "Who are my top trainers?"`,
    ``,
    `(Running in offline mode — add GROQ_API_KEY to .env.local for live AI reasoning.)`,
  ].join("\n");
}
