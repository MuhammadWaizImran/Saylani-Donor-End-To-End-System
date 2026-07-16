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
  getOrgStats,
  getPaymentOverview,
  getTopCampuses,
} from "@/lib/management-api";
import { BarList, PortalHeading, StatCard, TableShell, Td, Th, Avatar, Pill } from "@/components/portal/ui";
import { formatCompact, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

const TOP_CAMPUSES = 10;

export default async function AdminDashboardPage() {
  const [stats, campusPage, fees, attendance] = await Promise.all([
    getOrgStats(),
    getTopCampuses(TOP_CAMPUSES),
    getPaymentOverview(),
    getAttendanceOverview(),
  ]);
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

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="campus-performance-heading" className="portal-glow rounded-2xl border border-edge bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="campus-performance-heading" className="font-display text-xl text-black">
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

        <section aria-labelledby="recent-payments-heading" className="portal-glow rounded-2xl border border-edge bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="recent-payments-heading" className="font-display text-xl text-black">
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
