import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import {
  getFeaturedCampaigns,
  getRecentDonations,
  getSiteStats,
  getTestimonials,
} from "@/lib/api";
import { Hero } from "@/components/home/hero";
import { StatsBar } from "@/components/home/stats-bar";
import { DonationTicker } from "@/components/home/donation-ticker";
import { Mission3D } from "@/components/home/mission-3d";
import { ImpactVideo } from "@/components/home/impact-video";
import { TrustSection } from "@/components/home/trust-section";
import { Testimonials } from "@/components/home/testimonials";
import { CampaignSlider } from "@/components/campaigns/campaign-slider";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeading } from "@/components/ui/section-heading";

// Refresh from the database at most once a minute (ISR).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Home",
  description:
    "Beyond charity, we build tomorrows. Donate to SMIT campaigns for education, food, healthcare, clean water, and emergency relief.",
};

async function FeaturedCampaigns() {
  const featured = await getFeaturedCampaigns(6);
  return <CampaignSlider campaigns={featured} />;
}

export default async function HomePage() {
  const [stats, recentDonations, testimonials] = await Promise.all([
    getSiteStats(),
    getRecentDonations(10),
    getTestimonials(),
  ]);

  return (
    <div className="homepage-font">
      <Hero />
      <StatsBar stats={stats} />
      <div className="mt-16">
        <DonationTicker donations={recentDonations} />
      </div>

      <section className="py-24" aria-labelledby="featured-heading">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionHeading
            eyebrow="Where help is needed most"
            title="Featured campaigns,"
            titleAccent="urgent today"
            description="These campaigns need support right now. Every contribution moves the bar."
          />
        </div>
        <Suspense fallback={<Skeleton className="min-h-[82svh] w-full rounded-none" />}>
          <FeaturedCampaigns />
        </Suspense>
        <div className="mt-12 text-center">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-8 py-3.5 text-sm font-semibold text-black transition-all hover:scale-[1.03] hover:border-accent-500"
          >
            View all campaigns
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <Mission3D />
      <ImpactVideo />
      <TrustSection />
      <Testimonials testimonials={testimonials} />
    </div>
  );
}
