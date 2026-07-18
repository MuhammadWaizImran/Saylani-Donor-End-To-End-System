"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient background for the AI assistant — soft glowing orbs that drift and
 * pulse like fireflies. Purely decorative (no data encoded in color), so this
 * intentionally reuses the app's own brand/accent hues rather than picking
 * new ones: blue + green in light theme, plus white in dark theme, per the
 * user's request.
 */
const PALETTE_LIGHT = ["#3a96d4", "#0b73b7", "#8cc544", "#558124"];
const PALETTE_DARK = ["#52a5dc", "#66b2e4", "#8cc544", "#a3d45c", "#f3f8fc", "#ffffff"];

interface Firefly {
  x: number;
  y: number;
  angle: number; // direction of drift, radians
  speed: number; // px/sec
  turnRate: number; // how fast the drift direction wanders, rad/sec
  r: number; // glow radius, px
  baseAlpha: number;
  phase: number; // flicker phase offset
  flickerSpeed: number; // rad/sec
  colorIdx: number;
}

function makeFireflies(count: number, width: number, height: number): Firefly[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    angle: Math.random() * Math.PI * 2,
    speed: 6 + Math.random() * 14,
    turnRate: (Math.random() - 0.5) * 1.2,
    r: 2 + Math.random() * 3,
    baseAlpha: 0.35 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    flickerSpeed: 0.5 + Math.random() * 1,
    // Raw index, not pre-modulo'd against a palette length: drawFrame mods it
    // against whichever palette is CURRENT, so toggling theme (light: 4
    // colors, dark: 6, including white) reaches every color in the active
    // palette instead of freezing at the palette size seen at creation time.
    colorIdx: i,
  }));
}

export function FireflyParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let fireflies: Firefly[] = [];
    // Read live so an in-session theme toggle recolors without a remount.
    let isDark = document.documentElement.classList.contains("dark");

    function resize() {
      const rect = parent!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.max(16, Math.min(34, (width * height) / 26000)));
      if (fireflies.length !== target) {
        // Also covers first mount (fireflies.length starts at 0) and a
        // viewport change big enough to want more/fewer orbs.
        fireflies = makeFireflies(target, width, height);
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();

    const themeObserver = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains("dark");
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (reduceMotion) {
      // One still frame instead of a live loop — present, not distracting.
      drawFrame(ctx, fireflies, width, height, 0, isDark);
      return () => {
        ro.disconnect();
        themeObserver.disconnect();
      };
    }

    let raf = 0;
    let last = performance.now();
    let t = 0;

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      for (const f of fireflies) {
        f.angle += (Math.random() - 0.5) * f.turnRate * dt;
        f.x += Math.cos(f.angle) * f.speed * dt;
        f.y += Math.sin(f.angle) * f.speed * dt;
        // Wrap around edges with margin so orbs drift back in smoothly.
        const m = 24;
        if (f.x < -m) f.x = width + m;
        if (f.x > width + m) f.x = -m;
        if (f.y < -m) f.y = height + m;
        if (f.y > height + m) f.y = -m;
      }

      drawFrame(ctx!, fireflies, width, height, t, isDark);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
    />
  );
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  fireflies: Firefly[],
  width: number,
  height: number,
  t: number,
  isDark: boolean,
) {
  ctx.clearRect(0, 0, width, height);
  const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT;

  for (const f of fireflies) {
    // Gentle pulsing glow — never fully dark, so it reads as a soft flicker
    // rather than a blinking light.
    const pulse = 0.55 + 0.45 * Math.sin(f.phase + t * f.flickerSpeed);
    const alpha = f.baseAlpha * pulse;
    const color = palette[f.colorIdx % palette.length];
    const glowR = f.r * 4;

    const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glowR);
    gradient.addColorStop(0, hexToRgba(color, alpha));
    gradient.addColorStop(0.4, hexToRgba(color, alpha * 0.35));
    gradient.addColorStop(1, hexToRgba(color, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(f.x, f.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // A brighter core so each firefly has a visible centre, not just a haze.
    ctx.fillStyle = hexToRgba(color, Math.min(1, alpha * 1.6));
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
