import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  CalendarClock,
  GraduationCap,
  School,
  TrendingUp,
  Users,
} from "lucide-react";
import { getOrgStats, getPlacedStudents, getTopCampuses, resolveNames } from "@/lib/management-api";
import { BarList, PortalHeading, StatCard, TableShell, Td, Th, Avatar } from "@/components/portal/ui";
import { formatCompact, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

const TOP_CAMPUSES = 10;

export default async function AdminDashboardPage() {
  const [stats, campusPage, placed] = await Promise.all([
    getOrgStats(),
    getTopCampuses(TOP_CAMPUSES),
    getPlacedStudents(5),
  ]);
  const { campuses, total: totalCampuses } = campusPage;
  const moreCampuses = totalCampuses - campuses.length;
  const recentPlacements = placed;
  const [campusName, courseName] = await Promise.all([
    resolveNames("campuses", recentPlacements.map((s) => s.campusId)),
    resolveNames("courses", recentPlacements.map((s) => s.courseId)),
  ]);

  const cards = [
    { icon: Building2, label: "Total campuses", value: String(stats.totalCampuses) },
    { icon: GraduationCap, label: "Total students", value: formatCompact(stats.totalStudents, "") },
    { icon: Users, label: "Trainers", value: String(stats.totalTrainers) },
    { icon: School, label: "Running courses", value: String(stats.runningCourses) },
    { icon: CalendarClock, label: "Active classes", value: String(stats.activeClasses) },
    { icon: Briefcase, label: "Students placed", value: formatCompact(stats.studentsPlaced, "") },
    { icon: Banknote, label: "Avg placement salary", value: formatCompact(stats.avgPlacementSalary), sub: "per month" },
    { icon: TrendingUp, label: "Avg student progress", value: `${stats.avgStudentProgress}%`, sub: `${stats.avgAttendance}% avg attendance` },
  ];

  return (
    <>
      <PortalHeading
        title="Organization"
        accent="at a glance"
        description="Live view of every campus, classroom, and career Saylani is powering right now."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="campus-performance-heading" className="portal-glow rounded-2xl border border-edge bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="campus-performance-heading" className="font-display text-xl text-black">
              Campus-wise performance
            </h2>
            <Link href="/portal/admin/campuses" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              All campuses <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <BarList
            items={campuses.map((c) => ({
              label: `${c.name} — ${c.city}`,
              sub: `${c.studentCount.toLocaleString()} students`,
              percent: c.progressPercent,
            }))}
          />
        </section>

        <section aria-labelledby="recent-placements-heading" className="portal-glow rounded-2xl border border-edge bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="recent-placements-heading" className="font-display text-xl text-black">
              Recent job placements
            </h2>
            <Link href="/portal/admin/jobs" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              All placements <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-edge">
            {recentPlacements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {courseName[s.courseId] ?? "—"} · {campusName[s.campusId] ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-700">{formatCurrency(s.salary ?? 0)}</p>
                  <p className="text-xs text-ink-muted">{s.company}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="campus-table-heading" className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="campus-table-heading" className="font-display text-xl text-black">
            Campus summary <span className="font-sans text-sm text-ink-muted">(top {campuses.length} by students)</span>
          </h2>
          <Link href="/portal/admin/campuses" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            All {totalCampuses.toLocaleString()} campuses <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        <TableShell>
          <thead>
            <tr className="border-b border-edge bg-surface-muted">
              <Th>Campus</Th>
              <Th>Students</Th>
              <Th>Trainers</Th>
              <Th>Courses</Th>
              <Th>Placement rate</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {campuses.map((c) => (
              <tr key={c.id} className="hover:bg-surface-muted/60">
                <Td>
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="block text-xs text-ink-muted">{c.city}</span>
                </Td>
                <Td>{c.studentCount.toLocaleString()}</Td>
                <Td>{c.trainerCount}</Td>
                <Td>{c.courseCount}</Td>
                <Td>
                  <span className="font-bold text-accent-700">{c.placementRate}%</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
        {moreCampuses > 0 && (
          <p className="mt-3 text-center text-sm text-ink-muted">
            +{moreCampuses.toLocaleString()} more campuses —{" "}
            <Link href="/portal/admin/campuses" className="font-semibold text-brand-700 hover:underline">
              view all in Campuses
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
