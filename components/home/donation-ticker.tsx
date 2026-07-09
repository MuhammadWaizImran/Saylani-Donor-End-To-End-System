import { HeartHandshake } from "lucide-react";
import type { Donation } from "@/types";
import { formatCurrency, timeAgo } from "@/lib/utils";

export function DonationTicker({ donations }: { donations: Donation[] }) {
  // Duplicate the list so the marquee loops seamlessly (translateX(-50%)).
  const loop = [...donations, ...donations];
  return (
    <section
      aria-label="Recent donations"
      className="border-y border-edge bg-surface-muted py-3"
    >
      <div className="relative overflow-hidden">
        <div className="flex w-max animate-marquee gap-3 motion-reduce:animate-none">
          {loop.map((donation, i) => (
            <span
              key={`${donation.id}-${i}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-edge bg-surface px-4 py-1.5 text-xs font-medium text-ink-muted"
              aria-hidden={i >= donations.length}
            >
              <HeartHandshake className="h-3.5 w-3.5 text-accent-500" aria-hidden />
              <span className="font-bold text-ink">{donation.donorName}</span>
              donated
              <span className="font-bold text-brand-700 dark:text-brand-300">
                {formatCurrency(donation.amount)}
              </span>
              <span className="text-ink-muted/70">· {timeAgo(donation.createdAt)}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
