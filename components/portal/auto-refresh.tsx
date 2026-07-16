"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Silent polling for the portal. Every `intervalMs` it calls `router.refresh()`,
 * which re-runs the current page's server components and re-fetches from MongoDB,
 * so changes made directly in the database (e.g. via Compass) or by anyone else
 * appear within a few seconds — no manual page refresh needed.
 *
 * `router.refresh()` preserves client state (chat messages, half-filled forms,
 * scroll position), so polling never interrupts what the user is doing.
 *
 * Polling pauses while the tab is hidden and re-syncs immediately on return, so
 * a backgrounded dashboard doesn't hammer the database.
 */
export function AutoRefresh({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        router.refresh(); // catch up on anything missed while hidden
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
