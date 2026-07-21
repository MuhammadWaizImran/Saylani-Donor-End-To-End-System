import {
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
  getAssessmentPerformance,
  getAttendanceOverview,
  getCampuses,
  getCourseEnrolment,
  getEmploymentTrend,
  getEnrolmentStatusBreakdown,
  getEnrolmentVsDropoutTrend,
  getJobPlacementsByCourse,
  getOrgStats,
  getPaymentOverview,
  summarizeEnrolmentBuckets,
} from "@/lib/management-api";
import { PortalHeading, StatCard } from "@/components/portal/ui";
import { ChartCard, ChartTable, ColumnChart, DonutChart, MultiTrendArea } from "@/components/portal/charts";
import { ExportReportButton } from "@/components/portal/export-report-button";
import {
  BRIGHT_BLUE,
  CHART_SERIES,
  DONUT_BLUE,
  DONUT_CERTIFIED,
  DONUT_DROPOUT,
  DONUT_ENROLLED,
  DONUT_GREEN,
  DONUT_RED,
  TREND_GREEN,
  TREND_RED,
} from "@/lib/chart-palette";
import { formatCompact } from "@/lib/utils";

/** Short, collision-free x-axis tick for a course name — the full name still
 *  shows on hover and in the table view, so nothing is actually lost. */
function shortCourseLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 14 ? `${trimmed.slice(0, 13)}…` : trimmed;
}

/** Consistent "nothing here yet" body for a chart backed by a real query
 *  that just has zero matches right now (as opposed to no query at all). */
function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-edge bg-surface-muted p-8 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

export const metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [
    stats,
    fees,
    attendance,
    statusBreakdown,
    courseEnrolment,
    assessmentPerformance,
    enrolVsDropout,
    employmentTrend,
    jobPlacements,
    campuses,
  ] = await Promise.all([
    getOrgStats(),
    getPaymentOverview(),
    getAttendanceOverview(),
    getEnrolmentStatusBreakdown(),
    getCourseEnrolment(),
    getAssessmentPerformance(),
    getEnrolmentVsDropoutTrend(),
    getEmploymentTrend(),
    getJobPlacementsByCourse(),
    getCampuses(),
  ]);
  const coursesWithEnrolments = courseEnrolment.filter((c) => c.value > 0).length;
  const enrolmentBuckets = summarizeEnrolmentBuckets(statusBreakdown);
  const totalAssessments = assessmentPerformance.reduce((a, b) => a + b.value, 0);

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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <PortalHeading
          title="Organization"
          accent="at a glance"
          description="Live view of every campus, classroom, and rupee Saylani is managing right now."
        />
        <ExportReportButton campuses={campuses.map((c) => ({ id: c.id, name: c.name }))} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Row 1 — the two "state of the pipeline" donuts */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
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

        <ChartCard
          title="Assessment performance"
          subtitle="How assignment submissions are being reviewed and where they land"
          legend={[
            { label: "Approved", color: DONUT_GREEN },
            { label: "Unreviewed", color: DONUT_BLUE },
            { label: "Rejected", color: DONUT_RED },
          ]}
          table={
            <ChartTable
              head={["Outcome", "Submissions"]}
              rows={assessmentPerformance.map((s) => [s.label, s.value.toLocaleString()])}
            />
          }
        >
          {totalAssessments === 0 ? (
            <EmptyChart>No assignment submissions recorded yet.</EmptyChart>
          ) : (
            <DonutChart
              centerLabel="Submissions"
              format="number"
              data={assessmentPerformance.map((s) => ({
                ...s,
                color: s.label === "Approved" ? DONUT_GREEN : s.label === "Rejected" ? DONUT_RED : DONUT_BLUE,
              }))}
            />
          )}
        </ChartCard>
      </div>

      {/* Row 2 — course enrolment, and enrolments vs dropouts over time */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
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
            series={[{ label: "Students enrolled", color: BRIGHT_BLUE }]}
            format="number"
          />
        </ChartCard>

        <ChartCard
          title="Enrolment over time"
          subtitle="How new enrolments and dropouts have moved, month by month"
          legend={[
            { label: "Enrolments", color: TREND_GREEN },
            { label: "Dropouts", color: TREND_RED },
          ]}
          table={
            <ChartTable
              head={["Month", "Enrolments", "Dropouts"]}
              rows={enrolVsDropout.map((p) => [p.fullLabel, p.primary.toLocaleString(), p.secondary.toLocaleString()])}
            />
          }
        >
          <MultiTrendArea
            data={enrolVsDropout}
            primaryLabel="Enrolments"
            secondaryLabel="Dropouts"
            primaryColor={TREND_GREEN}
            secondaryColor={TREND_RED}
            format="number"
          />
        </ChartCard>
      </div>

      {/* Row 3 — employment. Genuinely not tracked in the source system today
          (see getEmploymentTrend/getJobPlacementsByCourse): both queries run
          for real against student_inductions.status, and will start showing
          data automatically the moment any record's status becomes
          placed/hired/employed — no code change needed then. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <ChartCard
          title="Employment trend"
          subtitle="Certified students vs. confirmed job placements, month by month"
          legend={[
            { label: "Certified", color: BRIGHT_BLUE },
            { label: "Employed", color: TREND_GREEN },
          ]}
          table={
            <ChartTable
              head={["Month", "Certified", "Employed"]}
              rows={employmentTrend.map((p) => [p.fullLabel, p.primary.toLocaleString(), p.secondary.toLocaleString()])}
            />
          }
        >
          {employmentTrend.length === 0 ? (
            // Only possible if the system has no certified-student history at
            // all — there's genuinely no axis to draw in that case.
            <EmptyChart>No enrolment history to chart yet.</EmptyChart>
          ) : (
            <MultiTrendArea
              data={employmentTrend}
              primaryLabel="Certified"
              secondaryLabel="Employed"
              primaryColor={BRIGHT_BLUE}
              secondaryColor={TREND_GREEN}
              format="number"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Job placements"
          subtitle="Which courses are producing the most employed graduates"
          table={
            <ChartTable
              head={["Course", "Placements"]}
              rows={jobPlacements.map((c) => [c.label, c.value.toLocaleString()])}
            />
          }
        >
          {jobPlacements.length === 0 ? (
            <EmptyChart>
              No job placements have been recorded yet. Once the training system starts tracking
              them, this chart populates automatically.
            </EmptyChart>
          ) : (
            <ColumnChart
              data={jobPlacements.map((c) => ({
                label: shortCourseLabel(c.label),
                fullLabel: c.label,
                values: [c.value],
              }))}
              series={[{ label: "Placements", color: CHART_SERIES[0] }]}
              format="number"
            />
          )}
        </ChartCard>
      </div>
    </>
  );
}
