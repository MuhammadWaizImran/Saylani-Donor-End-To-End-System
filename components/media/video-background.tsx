"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const FADE_MS = 500;
const FADE_OUT_LEAD_S = 0.55;
const RESTART_DELAY_MS = 100;

/**
 * Fullscreen looping video background with a seamless manual loop:
 * requestAnimationFrame monitors currentTime and cross-fades opacity
 * (0.5s in at the start, 0.5s out before the end), then resets and
 * replays — no visible loop jump. (Per the cinematic-hero reference spec.)
 */
export function VideoBackground({
  src,
  className,
  overlayClassName = "bg-gradient-to-b from-white via-white/35 to-white",
  objectPosition = "center",
}: {
  src: string;
  className?: string;
  overlayClassName?: string;
  objectPosition?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number>(0);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const cancelFade = () => cancelAnimationFrame(frameRef.current);

    /** Animate opacity from its current value toward `target` over FADE_MS. */
    const fadeTo = (target: number, onDone?: () => void) => {
      cancelFade();
      const from = parseFloat(video.style.opacity || "0");
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / FADE_MS);
        video.style.opacity = String(from + (target - from) * t);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          onDone?.();
        }
      };
      frameRef.current = requestAnimationFrame(step);
    };

    const monitor = () => {
      const remaining = video.duration - video.currentTime;
      if (!fadingOutRef.current && Number.isFinite(remaining) && remaining <= FADE_OUT_LEAD_S) {
        fadingOutRef.current = true;
        fadeTo(0);
      }
    };

    const onPlaying = () => {
      fadingOutRef.current = false;
      fadeTo(1);
    };

    const onEnded = () => {
      cancelFade();
      video.style.opacity = "0";
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
      }, RESTART_DELAY_MS);
    };

    video.style.opacity = "0";
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", monitor);
    video.addEventListener("ended", onEnded);
    video.play().catch(() => {
      // Autoplay blocked — show the poster frame instead.
      video.style.opacity = "1";
    });

    return () => {
      cancelFade();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", monitor);
      video.removeEventListener("ended", onEnded);
    };
  }, [src]);

  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden", className)}>
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        style={{ objectPosition, opacity: 0 }}
        tabIndex={-1}
      />
      <div className={cn("absolute inset-0", overlayClassName)} />
    </div>
  );
}
