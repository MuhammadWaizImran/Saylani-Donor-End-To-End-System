"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, HeartHandshake, Users } from "lucide-react";
import type { Campaign } from "@/types";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn, daysLeft, formatCurrency, percentFunded } from "@/lib/utils";

const presetAmounts = [500, 1000, 2500, 5000, 10000, 25000];

export function DonationPanel({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(2500);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const percent = percentFunded(campaign.raisedAmount, campaign.goalAmount);
  const remainingDays = daysLeft(campaign.endsAt);
  const amount = selected ?? Number(custom);
  const completed = campaign.status === "completed";

  const proceed = () => {
    if (!amount || Number.isNaN(amount) || amount < 100) {
      setError("Please enter an amount of at least Rs. 100.");
      return;
    }
    setError(null);
    router.push(`/donate?campaign=${campaign.id}&amount=${amount}`);
  };

  return (
    <div className="rounded-2xl border border-edge bg-surface p-6 shadow-lg shadow-brand-950/5">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-3xl text-brand-700 dark:text-brand-300">
          <AnimatedCounter value={campaign.raisedAmount} prefix="Rs. " />
        </p>
        <p className="text-sm font-semibold text-ink-muted">{percent}%</p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        raised of {formatCurrency(campaign.goalAmount)} goal
      </p>

      <ProgressBar percent={percent} className="mt-4 h-3" label={`${percent}% of goal reached`} />

      <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-accent-600" aria-hidden />
          <strong className="font-bold text-ink">{campaign.donorCount.toLocaleString()}</strong>
          donors
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-accent-600" aria-hidden />
          {completed ? "Campaign ended" : `${remainingDays} days left`}
        </span>
      </div>

      {!completed && (
        <>
          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-bold text-ink">Choose an amount</legend>
            <div className="grid grid-cols-3 gap-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelected(preset);
                    setCustom("");
                    setError(null);
                  }}
                  aria-pressed={selected === preset}
                  className={cn(
                    "rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition-colors",
                    selected === preset
                      ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "border-edge text-ink-muted hover:border-brand-300 hover:text-ink",
                  )}
                >
                  {formatCurrency(preset).replace("Rs. ", "Rs ")}
                </button>
              ))}
            </div>
            <label htmlFor="custom-amount" className="sr-only">
              Custom amount in rupees
            </label>
            <input
              id="custom-amount"
              type="number"
              min={100}
              inputMode="numeric"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setSelected(null);
                setError(null);
              }}
              placeholder="Or enter a custom amount (PKR)"
              className="mt-3 w-full rounded-xl border-2 border-edge bg-surface px-4 py-2.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
              aria-invalid={!!error}
              aria-describedby={error ? "amount-error" : undefined}
            />
            {error && (
              <p id="amount-error" role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </fieldset>

          <button
            type="button"
            onClick={proceed}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-bold text-accent-950 shadow-lg shadow-accent-500/25 transition-all hover:bg-accent-400"
          >
            <HeartHandshake className="h-5 w-5" aria-hidden />
            Donate {amount && !Number.isNaN(amount) && amount >= 100 ? formatCurrency(amount) : "Now"}
          </button>
          <p className="mt-3 text-center text-xs text-ink-muted">
            Secure donation · 100% goes to this campaign
          </p>
        </>
      )}

      {completed && (
        <div className="mt-6 rounded-xl bg-accent-50 p-4 text-center text-sm font-semibold text-accent-800 dark:bg-accent-950 dark:text-accent-300">
          This campaign reached its goal — thank you! New donations support the
          next cohort.
        </div>
      )}
    </div>
  );
}
