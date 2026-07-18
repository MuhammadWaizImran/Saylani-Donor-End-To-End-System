import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, HandCoins, Heart, Mail, Phone, Receipt } from "lucide-react";
import { getDonorById } from "@/lib/management-api";
import { Avatar, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const donor = await getDonorById(id);
  return { title: donor ? donor.name : "Donor" };
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function DonorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const donor = await getDonorById(id);
  if (!donor) notFound();

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
        <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-brand-solid via-brand-500 to-accent-500 sm:h-48">
          <div className="flex h-full w-full items-center justify-center">
            <Heart className="h-16 w-16 text-white/40" aria-hidden />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-6">
          <div className="-mt-16">
            <Avatar name={donor.name} className="h-24 w-24 text-3xl ring-4 ring-surface" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl text-ink-strong sm:text-4xl">{donor.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
              {donor.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {donor.email}
                </span>
              )}
              {donor.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  {donor.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                Donor since {formatDate(donor.memberSince)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={HandCoins} label="Lifetime given" value={formatCurrency(donor.totalDonated)} />
        <StatCard icon={Receipt} label="Total donations" value={donor.donationCount.toLocaleString()} />
        <StatCard icon={Heart} label="Campaigns supported" value={donor.campaignCount.toLocaleString()} />
      </div>

      {/* Donation history */}
      <section aria-labelledby="donor-history-heading" className="mt-10">
        <h2 id="donor-history-heading" className="mb-4 font-display text-xl text-ink-strong">
          Donation history
        </h2>
        {donor.donations.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No individual donation records are linked to this donor yet — their lifetime total above is
            the authoritative figure from their account.
          </div>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Campaign</Th>
                <Th>Amount</Th>
                <Th>Message</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {donor.donations.map((d) => (
                <tr key={d.id} className="group hover:bg-surface-muted/60">
                  <Td>
                    <Link
                      href={`/portal/admin/donations/${d.campaignId}`}
                      className="font-semibold text-ink group-hover:text-brand-700 hover:underline"
                    >
                      {d.campaignTitle}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-bold text-accent-700">{formatCurrency(d.amount)}</span>
                  </Td>
                  <Td className="max-w-xs truncate text-ink-muted">{d.message || "—"}</Td>
                  <Td className="text-ink-muted">{formatDate(d.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </>
  );
}
