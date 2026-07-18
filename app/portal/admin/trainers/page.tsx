import { resolveNames, searchTrainers } from "@/lib/management-api";
import { PortalHeading } from "@/components/portal/ui";
import { TrainersTable, type EnrichedTrainer } from "@/components/portal/trainers-table";

export const metadata = { title: "Trainers" };
export const dynamic = "force-dynamic";

export default async function TrainersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await searchTrainers({ query: params.q, page, pageSize: 20 });
  const campusName = await resolveNames("campuses", result.trainers.map((t) => t.campusId));

  const enriched: EnrichedTrainer[] = result.trainers.map((t) => ({
    ...t,
    campusName: campusName[t.campusId] ?? "—",
  }));

  return (
    <>
      <PortalHeading
        title="Trainers,"
        accent="the multiplier effect"
        description="Every trainer with their campus, specialization, hourly rate, students, and class slots."
      />
      <TrainersTable trainers={enriched} total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
