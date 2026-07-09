import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, MapPin } from "lucide-react";
import { getCampaign, getCampaigns, getDonations } from "@/lib/api";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { Gallery } from "@/components/campaigns/gallery";
import { DonationPanel } from "@/components/campaigns/donation-panel";
import { RecentDonors } from "@/components/campaigns/recent-donors";
import { ShareButtons } from "@/components/campaigns/share-buttons";
import { daysLeft } from "@/lib/utils";

// Refresh from the database at most once a minute (ISR).
export const revalidate = 60;

export async function generateStaticParams() {
  const campaigns = await getCampaigns();
  return campaigns.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return { title: "Campaign not found" };
  return {
    title: campaign.title,
    description: campaign.description,
    openGraph: {
      title: campaign.title,
      description: campaign.tagline,
      images: [{ url: campaign.imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: campaign.title,
      description: campaign.tagline,
    },
  };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const donations = await getDonations(campaign.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/campaigns"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted transition-colors hover:text-brand-700 dark:hover:text-brand-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All campaigns
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
        <article>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            <CategoryBadge>{campaign.category}</CategoryBadge>
            <span className="flex items-center gap-1 text-sm text-ink-muted">
              <MapPin className="h-4 w-4 text-accent-600" aria-hidden />
              {campaign.location}
            </span>
            {campaign.status !== "completed" && (
              <span className="flex items-center gap-1 text-sm text-ink-muted">
                <CalendarClock className="h-4 w-4 text-accent-600" aria-hidden />
                {daysLeft(campaign.endsAt)} days left
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
            {campaign.title}
          </h1>
          <p className="mt-3 text-lg text-ink-muted">{campaign.tagline}</p>

          <div className="mt-6">
            <Gallery images={campaign.gallery} title={campaign.title} />
          </div>

          <div className="mt-8 space-y-5">
            <h2 className="font-display text-2xl text-ink">The story</h2>
            {campaign.story.map((paragraph, i) => (
              <p key={i} className="leading-relaxed text-ink-muted">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-8 border-t border-edge pt-6">
            <ShareButtons title={campaign.title} />
          </div>

          <section className="mt-10" aria-labelledby="recent-donors-heading">
            <h2 id="recent-donors-heading" className="mb-4 font-display text-2xl text-ink">
              Recent donors
            </h2>
            <RecentDonors donations={donations.slice(0, 6)} />
          </section>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <DonationPanel campaign={campaign} />
        </aside>
      </div>
    </div>
  );
}
