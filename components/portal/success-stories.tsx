"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Quote, Sparkles } from "lucide-react";
import type { SuccessStory } from "@/types/management";
import { Pill } from "@/components/portal/ui";

const headline = "Every success story starts with someone who almost gave up.";

/** Splits the headline into words so it can reveal one word at a time. */
function AnimatedHeadline() {
  const words = headline.split(" ");
  return (
    <motion.h2
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.045 }}
      className="font-display text-2xl leading-snug tracking-tight text-ink-strong sm:text-3xl"
      aria-label={headline}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 14 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mr-[0.3em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </motion.h2>
  );
}

export function SuccessStoriesSection({ stories }: { stories: SuccessStory[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Success stories
      </div>
      <AnimatedHeadline />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: wordsDelay(headline), duration: 0.5 }}
        className="mt-3 max-w-2xl text-sm text-ink-muted"
      >
        Real graduates, real careers — a look at where SMIT training led them.
      </motion.p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {stories.map((story, i) => (
          <motion.article
            key={story.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: (i % 6) * 0.06, ease: "easeOut" }}
            className="portal-glow flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface"
          >
            <div className="relative h-48 w-full shrink-0 bg-surface-muted">
              <StoryPhoto photo={story.photo} name={story.name} />
              {story.isDemo && (
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Demo
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="font-display text-lg text-ink-strong">{story.name}</p>
              {story.designation && (
                <div className="mt-1">
                  <Pill tone="dark">{story.designation}</Pill>
                </div>
              )}
              <div className="mt-4 flex flex-1 gap-2 text-sm leading-relaxed text-ink-muted">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden />
                <p>{story.story}</p>
              </div>
              {story.description && (
                <p className="mt-3 text-xs text-ink-muted">{story.description}</p>
              )}
            </div>
          </motion.article>
        ))}
        {stories.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-ink-muted">
            No success stories yet.
          </p>
        )}
      </div>
    </div>
  );
}

/** Rough delay so the subtitle fades in right after the headline finishes animating. */
function wordsDelay(text: string): number {
  return text.split(" ").length * 0.045 + 0.15;
}

/** Story thumbnail with a graceful fallback: no URL, or a URL that 404s
 *  (the collection holds dead links), lands on the same "No photo" block
 *  instead of a broken image. */
function StoryPhoto({ photo, name }: { photo: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!photo || broken) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-muted">No photo</div>
    );
  }
  return (
    <Image
      src={photo}
      alt={name}
      fill
      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
      className="object-cover"
      unoptimized
      onError={() => setBroken(true)}
    />
  );
}
