import { GraduationCap, HandCoins, Megaphone, Users } from "lucide-react";
import type { SiteStats } from "@/types";
import { AnimatedCounter } from "@/components/ui/animated-counter";

export function StatsBar({ stats }: { stats: SiteStats }) {
  const items = [
    {
      icon: HandCoins,
      label: "Total raised",
      value: stats.totalRaised,
      prefix: "Rs. ",
      suffix: "",
      notation: "compact" as const,
    },
    {
      icon: Users,
      label: "Total donors",
      value: stats.totalDonors,
      prefix: "",
      suffix: "",
      notation: "compact" as const,
    },
    {
      icon: Megaphone,
      label: "Active campaigns",
      value: stats.activeCampaigns,
      prefix: "",
      suffix: "",
      notation: "standard" as const,
    },
    {
      icon: GraduationCap,
      label: "Lives impacted",
      value: stats.livesImpacted,
      prefix: "",
      suffix: "+",
      notation: "compact" as const,
    },
  ];

  return (
    <section aria-label="Live impact statistics" className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 sm:px-6 lg:px-8">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-edge bg-edge shadow-xl shadow-brand-950/5 lg:grid-cols-4">
        {items.map(({ icon: Icon, label, value, prefix, suffix, notation }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 bg-surface px-4 py-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-600 dark:bg-accent-950 dark:text-accent-400">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <dd className="font-display text-2xl text-brand-700 dark:text-brand-300 sm:text-3xl">
              <AnimatedCounter value={value} prefix={prefix} suffix={suffix} notation={notation} />
            </dd>
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
