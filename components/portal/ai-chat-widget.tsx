"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2, Sparkles, X } from "lucide-react";
import type { UserRole } from "@/types/management";
import { cn } from "@/lib/utils";
import type { AiAssistantHandle } from "@/components/portal/ai-assistant";

const AiAssistant = dynamic(
  () => import("@/components/portal/ai-assistant").then((module) => module.AiAssistant),
  { loading: () => <p className="p-6 text-sm text-ink-muted" role="status">Loading your assistant…</p> },
);

export function AiChatWidget({ role }: { role: Extract<UserRole, "admin" | "trainer"> }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [started, setStarted] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const assistant = useRef<AiAssistantHandle>(null);
  useEffect(() => {
    const showDashboard = () => setExpanded(false);
    window.addEventListener("smit:chart-drag", showDashboard);
    return () => window.removeEventListener("smit:chart-drag", showDashboard);
  }, []);

  const close = () => {
    assistant.current?.pauseVoice();
    setOpen(false);
    setExpanded(false);
    requestAnimationFrame(() => launcher.current?.focus());
  };

  return (
    <>
      <button
        ref={launcher}
        type="button"
        aria-label="Open AI chatbot"
        aria-expanded={open}
        aria-controls="dashboard-ai-chat"
        onClick={() => {
          setStarted(true);
          setOpen(true);
          requestAnimationFrame(() => closeButton.current?.focus());
        }}
        className={cn("fixed bottom-6 right-6 z-30 flex items-center gap-3 rounded-full bg-brand-solid px-5 py-4 font-semibold text-white shadow-xl shadow-brand-700/25 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500", open && "hidden")}
      >
        <Sparkles className="h-5 w-5" aria-hidden />
        <span>Ask AI</span>
      </button>

      {started && (
        <section
          id="dashboard-ai-chat"
          role="dialog"
          aria-labelledby="dashboard-ai-title"
          hidden={!open}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
          className={cn(
            "fixed z-50 flex min-h-0 flex-col overflow-hidden border border-edge bg-surface shadow-2xl",
            !open && "hidden",
            expanded
              ? "inset-0 h-dvh w-full"
              : "bottom-4 right-4 top-4 w-[calc(100%-2rem)] rounded-2xl sm:w-[380px] xl:w-[25vw]",
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-edge bg-gradient-to-r from-brand-50 to-accent-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 text-brand-700">
              <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
              <h2 id="dashboard-ai-title" className="truncate text-sm font-bold">Saylani Intelligence</h2>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? "Collapse AI chatbot" : "Expand AI chatbot to full screen"}
                title={expanded ? "Collapse" : "Full screen"}
                className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                {expanded ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
              </button>
              <button ref={closeButton} type="button" onClick={close} aria-label="Close AI chatbot" title="Close" className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1">
            <AiAssistant ref={assistant} role={role} compact={!expanded} />
          </div>
        </section>
      )}
    </>
  );
}
