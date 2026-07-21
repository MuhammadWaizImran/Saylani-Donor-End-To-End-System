"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Download, FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampusOption {
  id: string;
  name: string;
}

/**
 * "Export to sheet" — opens a small campus picker (the report is scoped to
 * one campus, or every campus), then downloads the generated PDF straight
 * to the admin's computer. Fetches the file as a blob rather than just
 * navigating to the API route, so the button can show a real "Generating…"
 * state instead of the browser's own bare loading spinner.
 */
export function ExportReportButton({ campuses }: { campuses: CampusOption[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/sponsorship?campus=${encodeURIComponent(selected)}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Export failed (${res.status})`);
      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "sponsorship-impact-report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand-400 hover:text-brand-700"
      >
        <Download className="h-4 w-4" aria-hidden />
        Export to sheet
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="export-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !busy && setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
              aria-hidden
            />
            <motion.div
              key="export-dialog"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-label="Export sponsorship report"
              className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-display text-lg text-ink-strong">Export sponsorship report</h2>
                    <p className="text-xs text-ink-muted">Downloads as a PDF, generated live from the database.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !busy && setOpen(false)}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink-strong"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <label htmlFor="export-campus" className="mb-1.5 mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                Which campus is this report for?
              </label>
              <select
                id="export-campus"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border-2 border-edge bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none disabled:opacity-60"
              >
                <option value="all">All Campuses</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                  {error}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={download}
                  disabled={busy}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.02] disabled:opacity-60",
                  )}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" aria-hidden />
                      Download PDF
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
