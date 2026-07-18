import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarClock,
  GraduationCap,
  Receipt,
  School,
  Users,
  Wallet,
} from "lucide-react";
import {
  getAttendanceOverview,
  getCourseEnrolment,
  getEnrolmentStatusBreakdown,
  getEnrolmentTrend,
  getFeeTrend,
  getOrgStats,
  getPaymentOverview,
  getTopCampuses,
  summarizeEnrolmentBuckets,
} from "@/lib/management-api";
import { BarList, PortalHeading, StatCard, TableShell, Td, Th, Avatar, Pill } from "@/components/portal/ui";
import { ChartCard, ChartTable, ColumnChart, DonutChart, TrendArea } from "@/components/portal/charts";
import { CHART_SERIES, DONUT_CERTIFIED, DONUT_DROPOUT, DONUT_ENROLLED } from "@/lib/chart-palette";
import { formatCompact, formatCurrency } from "@/lib/utils";

/** Short, collision-free x-axis tick for a course name — the full name still
 *  shows on hover and in the table view, so nothing is actually lost. */
function shortCourseLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 14 ? `${trimmed.slice(0, 13)}…` : trimmed;
}

export const metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

const TOP_CAMPUSES = 10;

export default async function AdminDashboardPage() {
  const [stats, campusPage, fees, attendance, feeTrend, enrolTrend, statusBreakdown, courseEnrolment] =
    await Promise.all([
      getOrgStats(),
      getTopCampuses(TOP_CAMPUSES),
      getPaymentOverview(),
      getAttendanceOverview(),
      getFeeTrend(),
      getEnrolmentTrend(),
      getEnrolmentStatusBreakdown(),
      getCourseEnrolment(),
    ]);
  const coursesWithEnrolments = courseEnrolment.filter((c) => c.value > 0).length;
  const enrolmentBuckets = summarizeEnrolmentBuckets(statusBreakdown);
  const { campuses, total: totalCampuses } = campusPage;
  const moreCampuses = totalCampuses - campuses.length;
  const recentPayments = fees.payments.slice(0, 5);
  const maxStudents = Math.max(1, ...campuses.map((c) => c.studentCount));

  const cards = [
    { icon: Building2, label: "Total campuses", value: String(stats.totalCampuses) },
    { icon: GraduationCap, label: "Total students", value: formatCompact(stats.totalStudents, "") },
    { icon: Users, label: "Trainers", value: String(stats.totalTrainers) },
    { icon: School, label: "Running courses", value: String(stats.runningCourses) },
    { icon: CalendarClock, label: "Active classes", value: String(stats.activeClasses) },
    { icon: Wallet, label: "Fees collected", value: formatCompact(fees.totalCollected) },
    { icon: Receipt, label: "Fees outstanding", value: formatCompact(fees.totalPending), sub: `${fees.pendingCount} pending invoices` },
    { icon: CalendarCheck, label: "Class check-ins logged", value: attendance.totalClassRecords.toLocaleString() },
  ];

  return (
    <>
      <PortalHeading
        title="Organization"
        accent="at a glance"
        description="Live view of every campus, classroom, and rupee Saylani is managing right now."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Fee collection — the widest series we have (real billing months) */}
      <div className="mt-10">
        <ChartCard
          title="Fee collection by month"
          subtitle={`Billed fees split into collected and outstanding · ${feeTrend.length} months on record`}
          legend={[
            { label: "Collected", color: CHART_SERIES[0] },
            { label: "Outstanding", color: CHART_SERIES[1] },
          ]}
          table={
            <ChartTable
              head={["Month", "Collected", "Outstanding", "Total billed"]}
              rows={feeTrend.map((p) => [
                p.fullLabel,
                formatCurrency(p.collected),
                formatCurrency(p.outstanding),
                formatCurrency(p.collected + p.outstanding),
              ])}
            />
          }
        >
          <ColumnChart
            data={feeTrend.map((p) => ({
              label: p.label,
              fullLabel: p.fullLabel,
              values: [p.collected, p.outstanding],
            }))}
            series={[
              { label: "Collected", color: CHART_SERIES[0] },
              { label: "Outstanding", color: CHART_SERIES[1] },
            ]}
            format="compact"
          />
        </ChartCard>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <ChartCard
          title="New enrolments by month"
          subtitle={`${enrolTrend.reduce((a, p) => a + p.value, 0).toLocaleString()} enrolments since ${enrolTrend[0]?.fullLabel ?? "—"}`}
          table={
            <ChartTable
              head={["Month", "Enrolments"]}
              rows={enrolTrend.map((p) => [p.fullLabel, p.value.toLocaleString()])}
            />
          }
        >
          <TrendArea data={enrolTrend} format="number" />
        </ChartCard>

        <ChartCard
          title="Enrolment breakdown"
          subtitle="Where every student stands, at a glance — the full status-by-status detail is one click away in the table view"
          legend={[
            { label: "Enrolled", color: DONUT_ENROLLED },
            { label: "Certified", color: DONUT_CERTIFIED },
            { label: "Dropout", color: DONUT_DROPOUT },
          ]}
          table={
            <ChartTable
              head={["Status", "Students"]}
              rows={statusBreakdown.map((s) => [s.label, s.value.toLocaleString()])}
            />
          }
        >
          <DonutChart
            centerLabel="Students"
            format="number"
            data={[
              { label: "Enrolled", value: enrolmentBuckets[0]?.value ?? 0, color: DONUT_ENROLLED },
              { label: "Certified", value: enrolmentBuckets[1]?.value ?? 0, color: DONUT_CERTIFIED },
              { label: "Dropout", value: enrolmentBuckets[2]?.value ?? 0, color: DONUT_DROPOUT },
            ]}
          />
        </ChartCard>
      </div>

      {/* Course enrolment — every course in the catalog, zeros included */}
      <div className="mt-8">
        <ChartCard
          title="Course enrolment"
          subtitle={`How many students are enrolled on each course · ${coursesWithEnrolments} of ${courseEnrolment.length} courses have anyone enrolled`}
          table={
            <ChartTable
              head={["Course", "Students enrolled"]}
              rows={courseEnrolment.map((c) => [c.label, c.value.toLocaleString()])}
            />
          }
        >
          <ColumnChart
            data={courseEnrolment.map((c) => ({
              label: shortCourseLabel(c.label),
              fullLabel: c.label,
              values: [c.value],
            }))}
            series={[{ label: "Students enrolled", color: CHART_SERIES[0] }]}
            format="number"
          />
        </ChartCard>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="campus-performance-heading" className="portal-glow rounded-2xl border border-edge bg-surface p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="campus-performance-heading" className="font-display text-xl text-ink-strong">
              Students by campus
            </h2>
            <Link href="/portal/admin/campuses" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              All campuses <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <BarList
            items={campuses.map((c) => ({
              label: `${c.name} — ${c.city}`,
              sub: `${c.studentCount.toLocaleString()} students · ${c.trainerCount} trainers`,
              percent: Math.round((c.studentCount / maxStudents) * 100),
            }))}
          />
        </section>

        <section aria-labelledby="recent-payments-heading" className="portal-glow rounded-2xl border border-edge bg-surface p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="recent-payments-heading" className="font-display text-xl text-ink-strong">
              Recent fee invoices
            </h2>
            <Link href="/portal/admin/payments" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              All payments <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-edge">
            {recentPayments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <Avatar name={p.studentName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{p.studentName}</p>
                  <p className="truncate text-xs text-ink-muted">{p.billingMonth} · due {p.dueDate || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-700">{formatCurrency(p.amount)}</p>
                  {p.status === "paid" ? <Pill tone="green">Paid</Pill> : <Pill tone="amber">Pending</Pill>}
                </div>
              </li>
            ))}
            {recentPayments.length === 0 && (
              <li className="py-8 text-center text-sm text-ink-muted">No fee invoices recorded yet.</li>
            )}
          </ul>
        </section>
      </div>

      <section aria-labelledby="campus-table-heading" className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="campus-table-heading" className="font-display text-xl text-ink-strong">
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
              <Th>Established</Th>
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
                <Td className="text-ink-muted">{c.established || "—"}</Td>
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
