"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProgressBar({
  percent,
  className,
  barClassName,
  label,
}: {
  percent: number;
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${clamped}% funded`}
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-brand-950",
        className,
      )}
    >
      <motion.div
        initial={{ width: reduceMotion ? `${clamped}%` : "0%" }}
        whileInView={{ width: `${clamped}%` }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500",
          barClassName,
        )}
      />
    </div>
  );
}
