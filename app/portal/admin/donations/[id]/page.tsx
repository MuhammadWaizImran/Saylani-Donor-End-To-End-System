import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, HandCoins, HeartHandshake, MapPin, Target, Users } from "lucide-react";
import { getCampaignDetail } from "@/lib/management-api";
import { Avatar, Pill, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { formatCompact, formatCurrency, percentFunded, timeAgo } from "@/lib/utils";
import type { CampaignStatus } from "@/types/management";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaignDetail(id);
  return { title: campaign ? campaign.title : "Campaign" };
}

const statusTone: Record<CampaignStatus, "green" | "amber" | "gray"> = {
  active: "green",
  urgent: "amber",
  completed: "gray",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : dateFormatter.format(d);
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaignDetail(id);
  if (!campaign) notFound();

  const funded = percentFunded(campaign.raisedAmount, campaign.goalAmount);
  const remaining = Math.max(0, campaign.goalAmount - campaign.raisedAmount);

  return (
    <>
      <Link
        href="/portal/admin/donations"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All donations
      </Link>

      {/* Hero */}
      <div className="portal-glow overflow-hidden rounded-2xl border border-edge bg-surface">
        <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-brand-solid via-brand-500 to-accent-500 sm:h-72">
          {campaign.imageUrl ? (
            <Image src={campaign.imageUrl} alt={campaign.title} fill className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <HeartHandshake className="h-16 w-16 text-white/40" aria-hidden />
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl text-ink-strong sm:text-4xl">{campaign.title}</h1>
                <Pill tone={statusTone[campaign.status]}>{campaign.status}</Pill>
              </div>
              {campaign.tagline && <p className="mt-2 text-sm text-ink-muted">{campaign.tagline}</p>}
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
                {campaign.category && <span>{campaign.category}</span>}
                {campaign.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {campaign.location}
                  </span>
                )}
                {campaign.endsAt && (
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    Ends {fmtDate(campaign.endsAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-6">
            <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-solid to-accent-500"
                style={{ width: `${funded}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-2xl text-ink-strong">
                {formatCurrency(campaign.raisedAmount, campaign.currency)}
              </span>
              <span className="text-sm text-ink-muted">
                raised of {formatCompact(campaign.goalAmount, campaign.currency)} goal · {funded}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={HandCoins} label="Raised" value={formatCompact(campaign.raisedAmount, campaign.currency)} />
        <StatCard icon={Target} label="Still needed" value={formatCompact(remaining, campaign.currency)} />
        <StatCard icon={Users} label="Donors" value={campaign.donorCount.toLocaleString()} />
        <StatCard
          icon={HeartHandshake}
          label="Donations logged"
          value={campaign.donations.length.toLocaleString()}
        />
      </div>

      {/* Description */}
      {campaign.description && (
        <section aria-labelledby="campaign-about-heading" className="mt-10">
          <h2 id="campaign-about-heading" className="mb-4 font-display text-xl text-ink-strong">
            About this campaign
          </h2>
          <p className="portal-glow rounded-2xl border border-edge bg-surface p-6 text-sm leading-relaxed text-ink">
            {campaign.description}
          </p>
        </section>
      )}

      {/* Story */}
      {campaign.story.length > 0 && (
        <section aria-labelledby="campaign-story-heading" className="mt-10">
          <h2 id="campaign-story-heading" className="mb-4 font-display text-xl text-ink-strong">
            The story
          </h2>
          <div className="portal-glow space-y-4 rounded-2xl border border-edge bg-surface p-6">
            {campaign.story.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink">
                {para}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {campaign.gallery.length > 0 && (
        <section aria-labelledby="campaign-gallery-heading" className="mt-10">
          <h2 id="campaign-gallery-heading" className="mb-4 font-display text-xl text-ink-strong">
            Gallery
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {campaign.gallery.map((src, i) => (
              <div
                key={src}
                className="portal-glow relative h-40 overflow-hidden rounded-2xl border border-edge bg-surface-muted"
              >
                <Image src={src} alt={`${campaign.title} — photo ${i + 1}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Donations */}
      <section aria-labelledby="campaign-donations-heading" className="mt-10">
        <h2 id="campaign-donations-heading" className="mb-4 font-display text-xl text-ink-strong">
          Donations to this campaign
        </h2>
        {campaign.donations.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No donations recorded for this campaign yet.
          </div>
        ) : (
          <TableShell minWidth={600}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Donor</Th>
                <Th>Amount</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {campaign.donations.map((d) => (
                <tr key={d.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={d.donorName} />
                      <div className="min-w-0">
                        <span className="font-semibold text-ink">{d.donorName}</span>
                        {d.message && <p className="max-w-md truncate text-xs text-ink-muted">“{d.message}”</p>}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-bold text-accent-700">{formatCurrency(d.amount, d.currency)}</span>
                  </Td>
                  <Td>{d.createdAt ? timeAgo(d.createdAt) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </>
  );
}
