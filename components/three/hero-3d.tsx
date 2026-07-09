"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

const HeroParticles = dynamic(() => import("./hero-particles"), { ssr: false });
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

type SceneMode = "loading" | "static" | "low" | "high";

function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

function getMode(): SceneMode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  return window.innerWidth < 768 ? "low" : "high";
}

/**
 * Lazy 3D layers, client-side only. Nothing renders under reduced motion,
 * and particle counts/DPR drop on small screens.
 */
export function Hero3DParticles() {
  const mode = useSyncExternalStore(subscribe, getMode, (): SceneMode => "loading");
  if (mode === "loading" || mode === "static") return null;
  return <HeroParticles quality={mode} />;
}

export function Hero3DScene() {
  const mode = useSyncExternalStore(subscribe, getMode, (): SceneMode => "loading");
  if (mode === "loading" || mode === "static") return null;
  return <HeroScene quality={mode} />;
}
