"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * Counts up to `value` when scrolled into view.
 *
 * Formatting is declarative (prefix/suffix/notation) rather than a function
 * prop so server components can render this without crossing the RSC
 * serialization boundary.
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  notation = "standard",
  duration = 1.6,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  notation?: "standard" | "compact";
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const total = reduceMotion ? 0 : duration * 1000;
    const tick = (now: number) => {
      const t = total === 0 ? 1 : Math.min(1, (now - start) / total);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    let frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduceMotion]);

  const formatted = new Intl.NumberFormat("en", {
    notation,
    maximumFractionDigits: notation === "compact" ? 1 : 0,
  }).format(notation === "compact" ? display : Math.round(display));

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
