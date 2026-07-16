import { getCampuses, resolveNames, searchStudents } from "@/lib/management-api";
import { PortalHeading } from "@/components/portal/ui";
import { StudentsTable, type EnrichedStudent } from "@/components/portal/students-table";

export const metadata = { title: "Students" };
export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  campus?: string;
  status?: string;
  page?: string;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [result, campusEntries] = await Promise.all([
    searchStudents({
      query: params.q,
      campusId: params.campus,
      enrollmentStatus: params.status,
      page,
      pageSize: 20,
    }),
    getCampuses(),
  ]);

  // Only resolve names for the ~20 rows on this page — not every campus/
  // course/trainer in the system.
  const [campusName, courseName, trainerName] = await Promise.all([
    resolveNames("campuses", result.students.map((s) => s.campusId)),
    resolveNames("courses", result.students.map((s) => s.courseId)),
    resolveNames("trainers", result.students.map((s) => s.trainerId)),
  ]);

  const enriched: EnrichedStudent[] = result.students.map((s) => ({
    ...s,
    campusName: campusName[s.campusId] ?? "—",
    courseName: courseName[s.courseId] ?? "—",
    trainerName: trainerName[s.trainerId] ?? "—",
  }));

  return (
    <>
      <PortalHeading
        title="Students,"
        accent="every single story"
        description="Every enrolled student with their campus, course, trainer, and live enrolment status."
      />
      <StudentsTable
        students={enriched}
        campuses={campusEntries.map((c) => ({ id: c.id, name: c.name }))}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
      />
    </>
  );
}
