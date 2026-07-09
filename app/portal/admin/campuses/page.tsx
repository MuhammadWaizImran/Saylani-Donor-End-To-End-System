import { searchCampuses } from "@/lib/management-api";
import { PortalHeading } from "@/components/portal/ui";
import { CampusesGrid } from "@/components/portal/campuses-grid";

export const metadata = { title: "Campuses" };
export const dynamic = "force-dynamic";

export default async function CampusesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await searchCampuses({ query: params.q, page, pageSize: 10 });

  return (
    <>
      <PortalHeading
        title="Campuses,"
        accent="city by city"
        description="Every Saylani campus with its students, trainers, courses, and overall progress."
      />
      <CampusesGrid
        campuses={result.campuses}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
      />
    </>
  );
}
