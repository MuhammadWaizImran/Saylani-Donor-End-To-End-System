import type { Metadata } from "next";
import { getCampaigns, getCategories, getLocations } from "@/lib/api";
import { CampaignsExplorer } from "@/components/campaigns/campaigns-explorer";

export const metadata: Metadata = {
  title: "Campaigns",
  description:
    "Browse all active, urgent, and completed SMIT donation campaigns — education, food relief, healthcare, clean water, and emergencies.",
  openGraph: {
    title: "Browse Campaigns | SMIT Donations",
    description: "Find a cause that speaks to you — every campaign is verified and fully transparent.",
  },
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [campaigns, categories, locations] = await Promise.all([
    getCampaigns(),
    getCategories(),
    getLocations(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-2xl">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">
          All campaigns
        </p>
        <h1 className="font-display text-4xl tracking-tight text-ink">
          Find a cause that speaks to you
        </h1>
        <p className="mt-3 text-ink-muted">
          Every campaign is verified by our field teams and reports exactly
          where your money goes.
        </p>
      </div>

      <CampaignsExplorer
        key={status ?? ""}
        campaigns={campaigns}
        categories={categories}
        locations={locations}
        initialStatus={status ?? ""}
      />
    </div>
  );
}
