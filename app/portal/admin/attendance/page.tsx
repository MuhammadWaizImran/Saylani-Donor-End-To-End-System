import { CalendarCheck, ClipboardList, Users } from "lucide-react";
import { getAttendanceOverview, resolveNames } from "@/lib/management-api";
import { Avatar, PortalHeading, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const overview = await getAttendanceOverview();
  const untracked = overview.totalStudents - overview.studentsTracked;
  const coverage = overview.totalStudents > 0 ? Math.round((overview.studentsTracked / overview.totalStudents) * 100) : 0;

  const [campusName, courseName] = await Promise.all([
    resolveNames("campuses", overview.records.map((r) => r.campusId)),
    resolveNames("courses", overview.records.map((r) => r.courseId)),
  ]);

  return (
    <>
      <PortalHeading
        title="Attendance,"
        accent="as it's actually logged"
        description="Real class check-ins from the training system — shown exactly as recorded, not estimated."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarCheck}
          label="Total check-ins logged"
          value={overview.totalClassRecords.toLocaleString()}
        />
        <StatCard
          icon={Users}
          label="Students with a record"
          value={`${overview.studentsTracked} / ${overview.totalStudents.toLocaleString()}`}
          sub={`${coverage}% coverage`}
        />
        <StatCard icon={ClipboardList} label="Classes represented" value={String(new Set(overview.records.map((r) => r.courseId)).size)} />
      </div>

      <section aria-labelledby="attendance-table-heading" className="mt-10">
        <h2 id="attendance-table-heading" className="mb-4 font-display text-xl text-black">
          Students with logged attendance
        </h2>
        {overview.records.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-white p-8 text-center text-sm text-ink-muted">
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
              {overview.records.map((r) => (
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
      </section>

      {untracked > 0 && (
        <p className="mt-4 text-center text-sm text-ink-muted">
          {untracked.toLocaleString()} other student{untracked === 1 ? "" : "s"} — no attendance recorded yet.
        </p>
      )}
    </>
  );
}
