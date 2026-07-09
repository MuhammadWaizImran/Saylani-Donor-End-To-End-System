"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { HeartHandshake } from "lucide-react";
import { VideoBackground } from "@/components/media/video-background";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const stats = [
  { value: 3600000, suffix: "+", label: "Meals served yearly" },
  { value: 78000, suffix: "+", label: "Students trained free" },
  { value: 120000, suffix: "+", label: "Patients treated" },
];

export function ImpactVideo() {
  return (
    <section
      aria-labelledby="impact-video-heading"
      className="relative min-h-[80svh] overflow-hidden"
    >
      <VideoBackground
        src="/media/impact.mp4"
        overlayClassName="bg-gradient-to-b from-white via-black/45 to-white"
      />

      <div className="relative z-10 mx-auto flex min-h-[80svh] max-w-5xl flex-col items-center justify-center px-6 py-28 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          id="impact-video-heading"
          className="font-display text-4xl leading-[1.02] tracking-[-0.02em] text-white drop-shadow-lg sm:text-6xl"
        >
          Behind every number,{" "}
          <em className="text-accent-300">a face. A name. A story.</em>
        </motion.h2>

        <motion.dl
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-14 grid w-full grid-cols-1 gap-6 sm:grid-cols-3"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/20 bg-black/30 px-6 py-7 backdrop-blur-md"
            >
              <dd className="font-display text-4xl text-white sm:text-5xl">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} notation="compact" />
              </dd>
              <dt className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-300">
                {stat.label}
              </dt>
            </div>
          ))}
        </motion.dl>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-12"
        >
          <Link
            href="/donate"
            className="inline-flex items-center gap-2.5 rounded-full bg-accent-500 px-12 py-5 text-base font-bold text-accent-950 shadow-2xl shadow-accent-500/30 transition-transform hover:scale-[1.03]"
          >
            <HeartHandshake className="h-5 w-5" aria-hidden />
            Be part of the story
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
