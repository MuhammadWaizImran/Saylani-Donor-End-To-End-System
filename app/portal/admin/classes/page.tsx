import { resolveNames, searchActiveClasses } from "@/lib/management-api";
import { PortalHeading } from "@/components/portal/ui";
import { ClassesGrid, type EnrichedClass } from "@/components/portal/classes-grid";

export const metadata = { title: "Active Classes" };
export const dynamic = "force-dynamic";

export default async function ActiveClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await searchActiveClasses({ query: params.q, page, pageSize: 10 });
  const [campusName, trainerName, courseName] = await Promise.all([
    resolveNames("campuses", result.classes.map((c) => c.campusId)),
    resolveNames("trainers", result.classes.map((c) => c.trainerId)),
    resolveNames("courses", result.classes.map((c) => c.courseId)),
  ]);

  const enriched: EnrichedClass[] = result.classes.map((c) => ({
    ...c,
    campusName: campusName[c.campusId] ?? "—",
    trainerName: trainerName[c.trainerId] ?? "—",
    courseName: courseName[c.courseId] ?? "—",
  }));

  return (
    <>
      <PortalHeading
        title="Active classes,"
        accent="happening right now"
        description="Every classroom currently in session — trainer, course, campus, headcount, and timing."
      />
      <ClassesGrid classes={enriched} total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
