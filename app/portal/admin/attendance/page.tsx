import { AlarmClock, CalendarCheck, ClipboardList, Clock, UserCheck, Users } from "lucide-react";
import {
  getAttendanceOverview,
  getAttendanceTrend,
  getTrainerAttendanceOverview,
  resolveNames,
} from "@/lib/management-api";
import { Avatar, PortalHeading, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { ChartCard, ChartTable, TrendArea } from "@/components/portal/charts";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

/** Minutes → compact "Xh Ym" (or "Ym" under an hour). */
function formatDuration(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function AttendancePage() {
  const [students, trainers, attendanceTrend] = await Promise.all([
    getAttendanceOverview(),
    getTrainerAttendanceOverview(),
    getAttendanceTrend(),
  ]);

  const untracked = students.totalStudents - students.studentsTracked;
  const coverage =
    students.totalStudents > 0
      ? Math.round((students.studentsTracked / students.totalStudents) * 100)
      : 0;
  const trainerUntracked = trainers.totalTrainers - trainers.trainersTracked;

  const [campusName, courseName, trainerName] = await Promise.all([
    resolveNames("campuses", students.records.map((r) => r.campusId)),
    resolveNames("courses", students.records.map((r) => r.courseId)),
    resolveNames("trainers", trainers.records.map((r) => r.trainerId)),
  ]);

  return (
    <>
      <PortalHeading
        title="Attendance,"
        accent="as it's actually logged"
        description="Real check-ins from the training system — students in class and trainers on campus, shown exactly as recorded, not estimated."
      />

      {/* Check-in activity over time — the whole logged history */}
      <div className="mb-10">
        <ChartCard
          title="Class check-ins by month"
          subtitle={
            attendanceTrend.length > 0
              ? `${students.totalClassRecords.toLocaleString()} check-ins logged from ${attendanceTrend[0].fullLabel} to ${attendanceTrend[attendanceTrend.length - 1].fullLabel}`
              : "No check-ins logged yet"
          }
          table={
            <ChartTable
              head={["Month", "Check-ins"]}
              rows={attendanceTrend.map((p) => [p.fullLabel, p.value.toLocaleString()])}
            />
          }
        >
          <TrendArea data={attendanceTrend} format="number" />
        </ChartCard>
      </div>

      {/* ── Students ────────────────────────────────────────── */}
      <section aria-labelledby="student-att-heading">
        <h2 id="student-att-heading" className="mb-4 font-display text-xl text-ink-strong">
          Student attendance
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={CalendarCheck}
            label="Total class check-ins"
            value={students.totalClassRecords.toLocaleString()}
          />
          <StatCard
            icon={Users}
            label="Students with a record"
            value={`${students.studentsTracked} / ${students.totalStudents.toLocaleString()}`}
            sub={`${coverage}% coverage`}
          />
          <StatCard
            icon={ClipboardList}
            label="Courses represented"
            value={String(new Set(students.records.map((r) => r.courseId)).size)}
          />
        </div>

        <div className="mt-5">
          {students.records.length === 0 ? (
            <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
              No attendance has been logged for any student yet.
            </div>
          ) : (
            <TableShell minWidth={640}>
              <thead>
                <tr className="border-b border-edge bg-surface-muted">
                  <Th>Student</Th>
                  <Th>Campus</Th>
                  <Th>Course</Th>
                  <Th>Classes attended</Th>
                  <Th>Last attended</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {students.records.map((r) => (
                  <tr key={r.studentId} className="hover:bg-surface-muted/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <span className="font-semibold text-ink">{r.name}</span>
                      </div>
                    </Td>
                    <Td>{campusName[r.campusId] ?? "—"}</Td>
                    <Td>{courseName[r.courseId] ?? "—"}</Td>
                    <Td>
                      <span className="font-bold text-accent-700">{r.classesAttended}</span>
                    </Td>
                    <Td>{r.lastAttended ? timeAgo(r.lastAttended) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
          {untracked > 0 && (
            <p className="mt-3 text-center text-sm text-ink-muted">
              {untracked.toLocaleString()} other student{untracked === 1 ? "" : "s"} — no attendance
              recorded yet.
            </p>
          )}
        </div>
      </section>

      {/* ── Trainers ────────────────────────────────────────── */}
      <section aria-labelledby="trainer-att-heading" className="mt-12">
        <h2 id="trainer-att-heading" className="mb-4 font-display text-xl text-ink-strong">
          Trainer attendance
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={UserCheck}
            label="Trainers checked in"
            value={`${trainers.trainersTracked} / ${trainers.totalTrainers.toLocaleString()}`}
          />
          <StatCard
            icon={Clock}
            label="Total time on campus"
            value={formatDuration(trainers.totalMinutes)}
            sub={`${trainers.totalSessions.toLocaleString()} sessions`}
          />
          <StatCard
            icon={AlarmClock}
            label="Late check-ins"
            value={trainers.records.reduce((sum, r) => sum + r.lateSessions, 0).toLocaleString()}
          />
        </div>

        <div className="mt-5">
          {trainers.records.length === 0 ? (
            <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
              No check-ins have been logged for any trainer yet.
            </div>
          ) : (
            <TableShell minWidth={640}>
              <thead>
                <tr className="border-b border-edge bg-surface-muted">
                  <Th>Trainer</Th>
                  <Th>Sessions</Th>
                  <Th>Time on campus</Th>
                  <Th>Late check-ins</Th>
                  <Th>Last check-in</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {trainers.records.map((r) => {
                  const name = trainerName[r.trainerId] ?? "—";
                  return (
                    <tr key={r.trainerId} className="hover:bg-surface-muted/60">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={name} />
                          <span className="font-semibold text-ink">{name}</span>
                        </div>
                      </Td>
                      <Td>
                        <span className="font-bold text-accent-700">{r.sessions}</span>
                      </Td>
                      <Td>{formatDuration(r.totalMinutes)}</Td>
                      <Td>
                        {r.lateSessions > 0 ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{r.lateSessions}</span>
                        ) : (
                          <span className="text-ink-muted">0</span>
                        )}
                      </Td>
                      <Td>{r.lastCheckIn ? timeAgo(r.lastCheckIn) : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
          {trainerUntracked > 0 && (
            <p className="mt-3 text-center text-sm text-ink-muted">
              {trainerUntracked.toLocaleString()} other trainer{trainerUntracked === 1 ? "" : "s"} —
              no check-ins recorded yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
