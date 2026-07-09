import type { Metadata } from "next";
import { getCampaigns } from "@/lib/api";
import { DonationWizard } from "@/components/donate/donation-wizard";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Make a donation to SMIT campaigns in four simple steps. JazzCash, Easypaisa, bank transfer, and card supported.",
  openGraph: {
    title: "Donate Now | SMIT Donations",
    description: "Four simple steps between you and someone's better tomorrow.",
  },
};

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; amount?: string }>;
}) {
  const { campaign, amount } = await searchParams;
  const campaigns = await getCampaigns();
  const parsedAmount = amount ? Number(amount) : undefined;

  return (
    <div className="bg-gradient-to-b from-brand-50 to-surface py-12 dark:from-brand-950 dark:to-surface">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">
            Make a donation
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink">
            Four steps to real impact
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-ink-muted">
            Choose a cause, tell us who you are, pick how to pay — and we take
            it from there.
          </p>
        </div>

        <DonationWizard
          campaigns={campaigns}
          initialCampaignId={campaign}
          initialAmount={
            parsedAmount && !Number.isNaN(parsedAmount) ? parsedAmount : undefined
          }
        />
      </div>
    </div>
  );
}
