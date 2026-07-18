import Link from "next/link";
import { ArrowRight, HandCoins, HeartHandshake, Megaphone, Users } from "lucide-react";
import { getDonationOverview } from "@/lib/management-api";
import { Avatar, Pill, PortalHeading, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { formatCompact, formatCurrency, percentFunded, timeAgo } from "@/lib/utils";
import type { CampaignStatus } from "@/types/management";

export const metadata = { title: "Donations" };
export const dynamic = "force-dynamic";

const statusTone: Record<CampaignStatus, "green" | "amber" | "gray"> = {
  active: "green",
  urgent: "amber",
  completed: "gray",
};

export default async function DonationsPage() {
  const o = await getDonationOverview();

  return (
    <>
      <PortalHeading
        title="Donations,"
        accent="campaigns & giving"
        description="Fundraising campaigns, incoming donations, and registered donors — read live from the database."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={HandCoins} label="Total raised" value={formatCompact(o.totalRaised)} />
        <StatCard icon={Megaphone} label="Active campaigns" value={`${o.activeCampaigns} / ${o.campaigns.length}`} />
        <StatCard icon={HeartHandshake} label="Donations received" value={o.totalDonations.toLocaleString()} />
        <StatCard icon={Users} label="Registered donors" value={o.totalDonors.toLocaleString()} />
      </div>

      {/* ── Campaigns ───────────────────────────────────────── */}
      <section aria-labelledby="campaigns-heading" className="mt-10">
        <h2 id="campaigns-heading" className="mb-4 font-display text-xl text-ink-strong">
          Campaigns
        </h2>
        {o.campaigns.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No campaigns in the database yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {o.campaigns.map((c) => {
              const funded = percentFunded(c.raisedAmount, c.goalAmount);
              return (
                <Link
                  key={c.id}
                  href={`/portal/admin/donations/${c.id}`}
                  className="portal-glow group rounded-2xl border border-edge bg-surface p-5 transition-all hover:-translate-y-0.5"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg text-ink-strong group-hover:text-brand-700">{c.title}</p>
                      <p className="text-xs text-ink-muted">
                        {c.category}
                        {c.location ? ` · ${c.location}` : ""}
                      </p>
                    </div>
                    <Pill tone={statusTone[c.status]}>{c.status}</Pill>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-solid to-accent-500"
                      style={{ width: `${funded}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-sm">
                    <span className="font-bold text-ink">{formatCurrency(c.raisedAmount, c.currency)}</span>
                    <span className="text-xs text-ink-muted">
                      of {formatCompact(c.goalAmount, c.currency)} · {funded}%
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-ink-muted">{c.donorCount.toLocaleString()} donors</p>
                    <span className="flex items-center gap-1 text-xs font-semibold text-brand-700">
                      Details
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Recent donations ────────────────────────────────── */}
      <section aria-labelledby="donations-heading" className="mt-10">
        <h2 id="donations-heading" className="mb-4 font-display text-xl text-ink-strong">
          Recent donations
        </h2>
        {o.donations.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No donations recorded yet.
          </div>
        ) : (
          <TableShell minWidth={680}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Donor</Th>
                <Th>Campaign</Th>
                <Th>Amount</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {o.donations.map((d) => (
                <tr key={d.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={d.donorName} />
                      <div className="min-w-0">
                        <span className="font-semibold text-ink">{d.donorName}</span>
                        {d.message && <p className="max-w-xs truncate text-xs text-ink-muted">“{d.message}”</p>}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {d.campaignId ? (
                      <Link
                        href={`/portal/admin/donations/${d.campaignId}`}
                        className="text-brand-700 hover:underline"
                      >
                        {d.campaignTitle}
                      </Link>
                    ) : (
                      d.campaignTitle
                    )}
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

      {/* ── Top donors ──────────────────────────────────────── */}
      <section aria-labelledby="donors-heading" className="mt-10">
        <h2 id="donors-heading" className="mb-4 font-display text-xl text-ink-strong">
          Top donors
        </h2>
        {o.donors.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No registered donors yet.
          </div>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Donor</Th>
                <Th>Email</Th>
                <Th>Lifetime given</Th>
                <Th>Donations</Th>
                <Th>Member since</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {o.donors.map((u) => (
                <tr key={u.id} className="group hover:bg-surface-muted/60">
                  <Td>
                    <Link
                      href={`/portal/admin/donors/${u.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar name={u.name} />
                      <span className="font-semibold text-ink group-hover:text-brand-700 group-hover:underline">
                        {u.name}
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">{u.email || "—"}</Td>
                  <Td>
                    <span className="font-bold text-accent-700">{formatCurrency(u.totalDonated)}</span>
                  </Td>
                  <Td>{u.donationCount.toLocaleString()}</Td>
                  <Td>{u.memberSince ? new Date(u.memberSince).toLocaleDateString("en-GB", { year: "numeric", month: "short" }) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </>
  );
}
