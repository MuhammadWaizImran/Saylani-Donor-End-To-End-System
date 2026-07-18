import {
  Building2,
  CalendarCheck,
  GraduationCap,
  School,
  Users,
} from "lucide-react";
import { getAttendanceOverview, getCampuses, getOrgStats, resolveNames } from "@/lib/management-api";
import { Avatar, BarList, PortalHeading, StatCard } from "@/components/portal/ui";
import { formatCompact, timeAgo } from "@/lib/utils";

export const metadata = { title: "Donor Dashboard" };
export const dynamic = "force-dynamic";

export default async function DonorDashboardPage() {
  const [stats, campuses, attendance] = await Promise.all([
    getOrgStats(),
    getCampuses(),
    getAttendanceOverview(),
  ]);
  const recentActivity = attendance.records.slice(0, 5);
  const courseName = await resolveNames("courses", recentActivity.map((r) => r.courseId));
  const maxStudents = Math.max(1, ...campuses.map((c) => c.studentCount));

  const orgCards = [
    { icon: Building2, label: "Campuses nationwide", value: String(stats.totalCampuses) },
    { icon: GraduationCap, label: "Students in training", value: formatCompact(stats.totalStudents, "") },
    { icon: Users, label: "Trainers on staff", value: String(stats.totalTrainers) },
    { icon: School, label: "Courses running", value: String(stats.runningCourses) },
  ];

  return (
    <>
      <PortalHeading
        title="Organization"
        accent="impact"
        description="A transparent view of what Saylani is doing right now — campuses, classrooms, and the students being trained."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {orgCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="donor-campus-heading" className="portal-glow rounded-2xl border border-edge bg-surface p-6">
          <h2 id="donor-campus-heading" className="mb-5 font-display text-xl text-ink-strong">
            Students by campus
          </h2>
          <BarList
            items={campuses.map((c) => ({
              label: `${c.name} — ${c.city}`,
              sub: `${c.studentCount.toLocaleString()} students · ${c.courseCount} courses`,
              percent: Math.round((c.studentCount / maxStudents) * 100),
            }))}
          />
        </section>

        <section aria-labelledby="donor-impact-heading" className="portal-glow flex flex-col rounded-2xl border border-edge bg-surface p-6">
          <h2 id="donor-impact-heading" className="mb-5 font-display text-xl text-ink-strong">
            Live classroom activity
          </h2>
          <ul className="flex-1 divide-y divide-edge">
            {recentActivity.map((r) => (
              <li key={r.studentId} className="flex items-center gap-3 py-3">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <p className="truncate text-xs text-ink-muted">{courseName[r.courseId] ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-700">{r.classesAttended} classes</p>
                  <p className="text-xs text-ink-muted">{r.lastAttended ? timeAgo(r.lastAttended) : "—"}</p>
                </div>
              </li>
            ))}
            {recentActivity.length === 0 && (
              <li className="py-8 text-center text-sm text-ink-muted">No classroom activity logged yet.</li>
            )}
          </ul>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-accent-50 p-4 text-sm text-accent-900">
            <CalendarCheck className="h-5 w-5 shrink-0" aria-hidden />
            <p>
              <span className="font-bold">{attendance.totalClassRecords.toLocaleString()} class check-ins</span>{" "}
              logged in the training system — every one a student showing up for a better future.
            </p>
          </div>
        </section>
      </div>

      <section aria-labelledby="donor-campus-detail-heading" className="mt-10">
        <h2 id="donor-campus-detail-heading" className="mb-4 font-display text-xl text-ink-strong">
          Campus details
        </h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campuses.map((c) => (
            <article key={c.id} className="portal-glow rounded-2xl border border-edge bg-surface p-5">
              <h3 className="font-display text-lg text-ink-strong">{c.name}</h3>
              <p className="text-xs text-ink-muted">{c.city}{c.established ? ` · since ${c.established}` : ""}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-surface-muted p-2.5">
                  <dd className="font-bold text-ink">{c.studentCount.toLocaleString()}</dd>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Students</dt>
                </div>
                <div className="rounded-xl bg-surface-muted p-2.5">
                  <dd className="font-bold text-ink">{c.courseCount}</dd>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Courses</dt>
                </div>
                <div className="rounded-xl bg-surface-muted p-2.5">
                  <dd className="font-bold text-accent-700">{c.trainerCount}</dd>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Trainers</dt>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
