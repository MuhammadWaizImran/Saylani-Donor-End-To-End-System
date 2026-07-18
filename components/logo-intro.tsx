"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import layerBase from "@/public/logo-intro/layer_base.png";
import layerArc from "@/public/logo-intro/layer_arc.png";
import layerFigure from "@/public/logo-intro/layer_figure.png";
import layerCap from "@/public/logo-intro/layer_cap.png";

// Cap (the last one-shot layer) lands at 2.25s + 0.95s = 3.2s; hold briefly,
// then fade the whole overlay out and unmount.
const HOLD_MS = 3800;
const FADE_MS = 500;
const LAYERS = [layerBase, layerArc, layerFigure, layerCap];

const noopSubscribe = () => () => {};
const readReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Shared box for each raster layer. `will-change` promotes them to their own
 *  compositing layer so the clip-path / transform animations stay smooth. */
const layerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  willChange: "clip-path, transform, opacity",
};

/**
 * Full-screen SMIT logo build-up shown on every page load before the app is
 * used — the "SMIT" wordmark types in, then the green arc + figure wipe in,
 * then the graduation cap drops in and settles.
 *
 * All four PNG layers are decoded up-front, and the animation only starts once
 * they're ready — so the very first play is smooth instead of janking while
 * images stream in. Honors prefers-reduced-motion.
 */
export function LogoIntro() {
  const reduceMotion = useSyncExternalStore(noopSubscribe, readReducedMotion, () => false);
  const [ready, setReady] = useState(false); // all layers decoded
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);

  // Decode every layer before the animation starts.
  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    Promise.all(
      LAYERS.map(
        (l) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = img.onerror = () => resolve();
            img.src = l.src;
          }),
      ),
    ).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reduceMotion]);

  // Once the build-up has played, fade out and unmount.
  useEffect(() => {
    if (!ready) return;
    const fade = setTimeout(() => setExiting(true), HOLD_MS);
    const finish = setTimeout(() => setDone(true), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(finish);
    };
  }, [ready]);

  if (reduceMotion || done) return null;

  return (
    <div
      aria-hidden
      // Deliberately white in BOTH themes (the user's choice) — the intro is
      // the original brand splash, not a themed surface.
      className="fixed inset-0 z-[200] flex items-center justify-center bg-white"
      style={{
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      {ready && (
        <div className="relative aspect-square w-[min(72vmin,560px)]">
          {/* eslint-disable @next/next/no-img-element -- decorative animation frames, not content images */}
          <img
            src={layerBase.src}
            alt=""
            style={{ ...layerStyle, animation: "smit-intro-typewriter 1.3s linear 0.15s both" }}
          />
          <div
            className="absolute top-[44%] h-[16%] w-[3px] bg-[#1b75bb]"
            style={{
              willChange: "left, opacity",
              animation:
                "smit-intro-caret-move 1.3s linear 0.15s both, smit-intro-caret-blink 0.5s step-end 1.45s 3, smit-intro-caret-fadeout 0.25s ease 1.95s both",
            }}
          />
          <img
            src={layerArc.src}
            alt=""
            style={{
              ...layerStyle,
              transformOrigin: "22% 44%",
              animation: "smit-intro-arc 0.7s cubic-bezier(.2,.7,.2,1) 2.15s both",
            }}
          />
          <img
            src={layerFigure.src}
            alt=""
            style={{
              ...layerStyle,
              transformOrigin: "63% 68%",
              animation:
                "smit-intro-figure 0.85s ease-out 2.2s both, smit-intro-wave-sway 4.2s ease-in-out 3.3s infinite",
            }}
          />
          <img
            src={layerCap.src}
            alt="SMIT — Saylani Mass IT Training"
            style={{
              ...layerStyle,
              transformOrigin: "26% 40%",
              animation:
                "smit-intro-cap-drop 0.95s cubic-bezier(.3,1.2,.5,1) 2.25s both, smit-intro-cap-bob 3.4s ease-in-out 3.4s infinite",
            }}
          />
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      )}
    </div>
  );
}
