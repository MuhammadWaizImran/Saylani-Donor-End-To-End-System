"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  MapPin,
  Users,
} from "lucide-react";
import type { Campaign } from "@/types";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn, daysLeft, formatCompact, formatCurrency, percentFunded } from "@/lib/utils";

const AUTOPLAY_MS = 6000;

export function CampaignSlider({ campaigns }: { campaigns: Campaign[] }) {
  const reduceMotion = useReducedMotion();
  const [[index, direction], setIndex] = useState<[number, number]>([0, 1]);

  const count = campaigns.length;
  const campaign = campaigns[index];
  const percent = percentFunded(campaign.raisedAmount, campaign.goalAmount);

  const go = (dir: number) =>
    setIndex(([i]) => [(i + dir + count) % count, dir]);
  const goTo = (target: number) =>
    setIndex(([i]) => [target, target > i ? 1 : -1]);

  // Always auto-advance — hovering or focusing the slider does not pause it.
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => {
      setIndex(([i]) => [(i + 1) % count, 1]);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count]);

  const slideVariants = {
    enter: (dir: number) => ({
      x: reduceMotion ? 0 : dir > 0 ? "100%" : "-100%",
      opacity: reduceMotion ? 0 : 1,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: reduceMotion ? 0 : dir > 0 ? "-100%" : "100%",
      opacity: reduceMotion ? 0 : 1,
    }),
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      className="group relative min-h-[82svh] w-full overflow-hidden bg-brand-950"
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={campaign.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${count}: ${campaign.title}`}
        >
          {/* Slow ken-burns zoom on the image for a cinematic feel */}
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: reduceMotion ? 1 : 1.08 }}
            transition={{ duration: AUTOPLAY_MS / 1000 + 2, ease: "linear" }}
            className="absolute inset-0"
          >
            <Image
              src={campaign.imageUrl}
              alt={campaign.title}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
          {/* Readability gradients — dark from the left/bottom */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/15"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent"
          />

          {/* Slide content — everything the cards used to show */}
          <div className="relative z-10 mx-auto flex min-h-[82svh] max-w-7xl flex-col justify-center px-6 py-20 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="max-w-2xl"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusBadge status={campaign.status} />
                <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur">
                  {campaign.category}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-white/80">
                  <MapPin className="h-3.5 w-3.5 text-accent-400" aria-hidden />
                  {campaign.location}
                </span>
              </div>

              <h3 className="mt-5 font-display text-4xl leading-[1.02] tracking-[-0.02em] text-white sm:text-6xl">
                {campaign.title}
              </h3>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
                {campaign.tagline}
              </p>

              <div className="mt-8 max-w-xl space-y-3">
                <ProgressBar
                  percent={percent}
                  className="h-3 bg-white/20"
                  label={`${campaign.title}: ${percent}% funded`}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-2xl text-accent-300 sm:text-3xl">
                    {formatCurrency(campaign.raisedAmount)}
                  </span>
                  <span className="text-sm text-white/75">
                    of {formatCompact(campaign.goalAmount)} · {percent}% funded
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-5 text-sm text-white/80">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-accent-400" aria-hidden />
                    {campaign.donorCount.toLocaleString()} donors
                  </span>
                  {campaign.status !== "completed" && (
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 text-accent-400" aria-hidden />
                      {daysLeft(campaign.endsAt)} days left
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href={`/donate?campaign=${campaign.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-8 py-3.5 text-sm font-bold text-accent-950 shadow-xl shadow-accent-500/25 transition-transform hover:scale-[1.03]"
                >
                  <HeartHandshake className="h-4 w-4" aria-hidden />
                  Donate Now
                </Link>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition-all hover:scale-[1.03] hover:border-accent-400"
                >
                  Read the story
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Prev / next arrows */}
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous campaign"
        className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur transition-all hover:scale-105 hover:border-accent-400 sm:flex"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next campaign"
        className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur transition-all hover:scale-105 hover:border-accent-400 sm:flex"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5">
        {campaigns.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}: ${c.title}`}
            aria-current={i === index ? "true" : undefined}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === index
                ? "w-8 bg-accent-400"
                : "w-2 bg-white/40 hover:bg-white/70",
            )}
          />
        ))}
      </div>
    </section>
  );
}
