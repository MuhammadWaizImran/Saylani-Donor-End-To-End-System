"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Users } from "lucide-react";
import type { Campaign } from "@/types";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCompact, formatCurrency, percentFunded } from "@/lib/utils";

export function CampaignCard({ campaign, index = 0 }: { campaign: Campaign; index?: number }) {
  const percent = percentFunded(campaign.raisedAmount, campaign.goalAmount);

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.08, 0.4) }}
      whileHover={{ y: -6 }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm transition-shadow hover:shadow-xl hover:shadow-brand-600/10"
    >
      <Link href={`/campaigns/${campaign.id}`} className="flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-muted">
          <Image
            src={campaign.imageUrl}
            alt={campaign.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            <StatusBadge status={campaign.status} />
          </div>
          <div className="absolute bottom-3 right-3">
            <span className="rounded-full bg-brand-950/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
              {percent}% funded
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <CategoryBadge>{campaign.category}</CategoryBadge>
            <span className="flex items-center gap-1 text-xs font-medium text-ink-muted">
              <MapPin className="h-3.5 w-3.5 text-accent-600" aria-hidden />
              {campaign.location}
            </span>
          </div>

          <h3 className="font-display text-lg leading-snug text-ink group-hover:text-brand-700 dark:group-hover:text-brand-300">
            {campaign.title}
          </h3>
          <p className="line-clamp-2 text-sm text-ink-muted">{campaign.tagline}</p>

          <div className="mt-auto space-y-2 pt-2">
            <ProgressBar percent={percent} label={`${campaign.title}: ${percent}% funded`} />
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-bold text-brand-700 dark:text-brand-300">
                {formatCurrency(campaign.raisedAmount)}
              </span>
              <span className="text-xs text-ink-muted">
                of {formatCompact(campaign.goalAmount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Users className="h-3.5 w-3.5 text-accent-600" aria-hidden />
              {campaign.donorCount.toLocaleString()} donors
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
