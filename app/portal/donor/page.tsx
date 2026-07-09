import {
  Banknote,
  Briefcase,
  Building2,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  School,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getCampuses, getLookups, getOrgStats, getPlacedStudents } from "@/lib/management-api";
import { getSiteStats } from "@/lib/api";
import { Avatar, BarList, PortalHeading, StatCard } from "@/components/portal/ui";
import { formatCompact, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Donor Dashboard" };
export const dynamic = "force-dynamic";

export default async function DonorDashboardPage() {
  const [stats, campuses, donations, placed, lookups] = await Promise.all([
    getOrgStats(),
    getCampuses(),
    getSiteStats(),
    getPlacedStudents(),
    getLookups(),
  ]);
  const recentPlacements = placed.slice(0, 5);

  const orgCards = [
    { icon: Building2, label: "Campuses nationwide", value: String(stats.totalCampuses) },
    { icon: GraduationCap, label: "Students in training", value: formatCompact(stats.totalStudents, "") },
    { icon: Users, label: "Trainers on staff", value: String(stats.totalTrainers) },
    { icon: School, label: "Courses running", value: String(stats.runningCourses) },
    { icon: Briefcase, label: "Careers launched", value: formatCompact(stats.studentsPlaced, "") },
    { icon: Banknote, label: "Avg graduate salary", value: formatCompact(stats.avgPlacementSalary), sub: "per month" },
    { icon: TrendingUp, label: "Avg student progress", value: `${stats.avgStudentProgress}%`, sub: `${stats.avgAttendance}% attendance` },
    { icon: HandCoins, label: "Donations raised", value: formatCompact(donations.totalRaised), sub: `${formatCompact(donations.totalDonors, "")} donors` },
  ];

  return (
    <>
      <PortalHeading
        title="Your giving,"
        accent="at work"
        description="A transparent view of what Saylani is doing with every rupee — campuses, students, progress, and the careers your donations create."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {orgCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="donor-campus-heading" className="portal-glow rounded-2xl border border-edge bg-white p-6">
          <h2 id="donor-campus-heading" className="mb-5 font-display text-xl text-black">
            Campus-wise performance
          </h2>
          <BarList
            items={campuses.map((c) => ({
              label: `${c.name} — ${c.city}`,
              sub: `${c.studentCount.toLocaleString()} students · ${c.placementRate}% placed`,
              percent: c.progressPercent,
            }))}
          />
        </section>

        <section aria-labelledby="donor-impact-heading" className="portal-glow flex flex-col rounded-2xl border border-edge bg-white p-6">
          <h2 id="donor-impact-heading" className="mb-5 font-display text-xl text-black">
            Lives your donations changed
          </h2>
          <ul className="flex-1 divide-y divide-edge">
            {recentPlacements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                  <p className="truncate text-xs text-ink-muted">{lookups.courseName[s.courseId] ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-700">{formatCurrency(s.salary ?? 0)}/mo</p>
                  <p className="text-xs text-ink-muted">{s.company}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl bg-accent-50 p-4 text-sm text-accent-900">
            Every <span className="font-bold">Rs. 25,000</span> you donate funds one full year of
            training — and graduates earn an average of{" "}
            <span className="font-bold">{formatCurrency(stats.avgPlacementSalary)}/month</span>.
            That&apos;s not charity; that&apos;s compounding impact.
          </div>
          <Link
            href="/donate"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-accent-950 transition-transform hover:scale-[1.02]"
          >
            <HeartHandshake className="h-4 w-4" aria-hidden />
            Donate again
          </Link>
        </section>
      </div>

      <section aria-labelledby="donor-campus-detail-heading" className="mt-10">
        <h2 id="donor-campus-detail-heading" className="mb-4 font-display text-xl text-black">
          Campus details
        </h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campuses.map((c) => (
            <article key={c.id} className="portal-glow rounded-2xl border border-edge bg-white p-5">
              <h3 className="font-display text-lg text-black">{c.name}</h3>
              <p className="text-xs text-ink-muted">{c.city} · since {c.established}</p>
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
                  <dd className="font-bold text-accent-700">{c.placementRate}%</dd>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Placed</dt>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
