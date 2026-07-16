import { resolveNames, searchCourses } from "@/lib/management-api";
import { PortalHeading } from "@/components/portal/ui";
import { CoursesTable, type EnrichedCourse } from "@/components/portal/courses-table";

export const metadata = { title: "Courses" };
export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await searchCourses({ query: params.q, status: params.status, page, pageSize: 20 });
  const [campusName, trainerName] = await Promise.all([
    resolveNames("campuses", result.courses.map((c) => c.campusId)),
    resolveNames("trainers", result.courses.map((c) => c.trainerId)),
  ]);

  const enriched: EnrichedCourse[] = result.courses.map((c) => ({
    ...c,
    campusName: campusName[c.campusId] ?? "—",
    trainerName: trainerName[c.trainerId] ?? "—",
  }));

  return (
    <>
      <PortalHeading
        title="Courses,"
        accent="running across Pakistan"
        description="Every course offering with its campus, status, trainer, enrollment, and duration."
      />
      <CoursesTable courses={enriched} total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
