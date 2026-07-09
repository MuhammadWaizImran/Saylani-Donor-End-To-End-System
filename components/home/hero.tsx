"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, HeartHandshake } from "lucide-react";

const fadeRise = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const, delay },
});

export function Hero() {
  return (
    <section className="relative min-h-[92svh] w-full overflow-hidden bg-accent-50">
      {/* Static green texture backdrop — no motion, just a flat tinted
          surface with a faint fabric-like crosshatch. */}
      <div aria-hidden className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, var(--color-accent-800) 0, var(--color-accent-800) 1px, transparent 1px, transparent 14px),
              repeating-linear-gradient(-45deg, var(--color-accent-800) 0, var(--color-accent-800) 1px, transparent 1px, transparent 14px)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
      </div>

      {/* Layer 2 — hero content */}
      <div className="relative z-10 mx-auto flex min-h-[92svh] max-w-7xl flex-col items-center justify-center px-6 pb-24 pt-16 text-center">
        <motion.p
          {...fadeRise(0)}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-300 bg-white/80 px-5 py-2 text-sm font-medium text-brand-700 shadow-sm backdrop-blur"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-accent-500" aria-hidden />
          Trusted by 120,000+ donors across Pakistan
        </motion.p>

        <motion.h1
          {...fadeRise(0.1)}
          className="max-w-6xl font-display text-5xl leading-[0.95] tracking-[-0.03em] text-black sm:text-7xl md:text-8xl"
        >
          Beyond <em className="text-[#6F6F6F]">charity,</em> we build{" "}
          <em className="text-[#6F6F6F]">tomorrows.</em>
        </motion.h1>

        <motion.p
          {...fadeRise(0.2)}
          className="mt-8 max-w-2xl text-base leading-relaxed text-[#6F6F6F] sm:text-lg"
        >
          From free IT education to daily meals, clean water, and emergency
          relief — SMIT turns every rupee you give into someone&apos;s new
          beginning, with full transparency at every step.
        </motion.p>

        <motion.div {...fadeRise(0.4)} className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/donate"
            className="inline-flex items-center gap-2.5 rounded-full bg-brand-700 px-14 py-5 text-base font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            <HeartHandshake className="h-5 w-5 text-accent-400" aria-hidden />
            Begin Giving
          </Link>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/80 px-10 py-5 text-base font-semibold text-black backdrop-blur transition-all hover:scale-[1.03] hover:border-accent-500"
          >
            Explore Campaigns
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
