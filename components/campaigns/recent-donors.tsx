import { HeartHandshake, UserRound } from "lucide-react";
import type { Donation } from "@/types";
import { formatCurrency, timeAgo } from "@/lib/utils";

export function RecentDonors({ donations }: { donations: Donation[] }) {
  if (donations.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-edge p-6 text-center text-sm text-ink-muted">
        Be the first to donate to this campaign.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {donations.map((donation) => (
        <li
          key={donation.id}
          className="flex items-start gap-3 rounded-xl border border-edge bg-surface p-4"
        >
          <span
            aria-hidden
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300"
          >
            {donation.isAnonymous ? (
              <UserRound className="h-4 w-4" />
            ) : (
              <span className="font-display text-xs">
                {donation.donorName
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              <span className="font-bold">{donation.donorName}</span> donated{" "}
              <span className="font-bold text-brand-700 dark:text-brand-300">
                {formatCurrency(donation.amount)}
              </span>
            </p>
            {donation.message && (
              <p className="mt-1 text-sm italic text-ink-muted">&ldquo;{donation.message}&rdquo;</p>
            )}
            <p className="mt-1 text-xs text-ink-muted/80">{timeAgo(donation.createdAt)}</p>
          </div>
          <HeartHandshake className="h-4 w-4 shrink-0 text-accent-500" aria-hidden />
        </li>
      ))}
    </ul>
  );
}
