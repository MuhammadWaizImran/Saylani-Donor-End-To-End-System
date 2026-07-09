import { Banknote, Briefcase, TrendingUp } from "lucide-react";
import { getPlacedStudents, resolveNames, searchStudents } from "@/lib/management-api";
import { PortalHeading, StatCard } from "@/components/portal/ui";
import { formatCompact } from "@/lib/utils";
import { JobsTable, type EnrichedPlacement } from "@/components/portal/jobs-table";

export const metadata = { title: "Jobs Secured" };
export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [result, statsSample] = await Promise.all([
    searchStudents({ placementStatus: "placed", query: params.q, page, pageSize: 20 }),
    // Bounded sample for the summary cards — exact org-wide average lives in getOrgStats.
    getPlacedStudents(500),
  ]);
  const salaries = statsSample.map((s) => s.salary ?? 0);
  const avgSalary = Math.round(salaries.reduce((a, b) => a + b, 0) / Math.max(1, salaries.length));
  const topSalary = Math.max(...salaries, 0);

  const [campusName, courseName, trainerName] = await Promise.all([
    resolveNames("campuses", result.students.map((s) => s.campusId)),
    resolveNames("courses", result.students.map((s) => s.courseId)),
    resolveNames("trainers", result.students.map((s) => s.trainerId)),
  ]);

  const enriched: EnrichedPlacement[] = result.students.map((s) => ({
    ...s,
    campusName: campusName[s.campusId] ?? "—",
    courseName: courseName[s.courseId] ?? "—",
    trainerName: trainerName[s.trainerId] ?? "—",
  }));

  return (
    <>
      <PortalHeading
        title="Jobs secured,"
        accent="the finish line"
        description="Students from this cohort who completed training and are now employed."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Briefcase} label="Total placements" value={result.total.toLocaleString()} />
        <StatCard icon={Banknote} label="Average salary" value={formatCompact(avgSalary)} sub="per month" />
        <StatCard icon={TrendingUp} label="Highest package" value={formatCompact(topSalary)} sub="per month" />
      </div>

      <JobsTable placed={enriched} total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
