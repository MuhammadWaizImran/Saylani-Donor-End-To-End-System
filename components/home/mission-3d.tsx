"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

export function Mission3D() {
  return (
    <section className="bg-white py-24" aria-labelledby="mission-heading">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <motion.p
          {...reveal}
          transition={{ duration: 0.7 }}
          className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent-600"
        >
          One heart, one world
        </motion.p>
        <motion.h2
          {...reveal}
          transition={{ duration: 0.7, delay: 0.1 }}
          id="mission-heading"
          className="font-display text-4xl leading-[1.02] tracking-[-0.02em] text-black sm:text-6xl"
        >
          Giving that <em className="text-[#6F6F6F]">outlives</em> the gift
        </motion.h2>
        <motion.p
          {...reveal}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#6F6F6F] sm:text-lg"
        >
          A meal ends hunger for a day. A skill ends it for a lifetime. As
          Pakistan&apos;s largest free IT training movement, we pair immediate
          relief — food, water, healthcare — with education that turns
          today&apos;s beneficiaries into tomorrow&apos;s providers.
        </motion.p>
        <motion.div {...reveal} transition={{ duration: 0.7, delay: 0.3 }} className="mt-10">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-8 py-3.5 text-sm font-semibold text-black transition-all hover:scale-[1.03] hover:border-accent-500"
          >
            Explore our campaigns
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
