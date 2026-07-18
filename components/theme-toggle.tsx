"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "smit-theme";

/* The source of truth is the `.dark` class on <html> — set before paint by
 * the inline script in app/layout.tsx. This tiny store mirrors it so React
 * re-renders when the toggle flips the class. */
let listeners: Array<() => void> = [];
const subscribe = (cb: () => void) => {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
};
const getSnapshot = () => document.documentElement.classList.contains("dark");
// Server render can't know the saved theme; the pre-paint script has already
// settled the real class by the time hydration compares snapshots.
const getServerSnapshot = () => false;

function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Storage unavailable (private mode) — theme still applies this visit,
    // it just won't persist.
  }
  for (const l of listeners) l();
}

/** Light ⇄ dark switch for the portal topbar. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setTheme(!dark)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-700"
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
