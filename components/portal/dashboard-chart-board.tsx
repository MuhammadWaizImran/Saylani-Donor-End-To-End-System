"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type DragEvent,
} from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { ChartSpec } from "@/lib/ai/chart-spec";
import { defaultChartIds, type LayoutChange } from "@/lib/ai/dashboard-layout";
import { AiChart, CHART_DRAG_TYPE } from "./ai-chart";

type SavedLayout = { items: string[]; charts: ChartSpec[]; revision: number };
const names = [
  "Enrolment breakdown",
  "Assessment performance",
  "Course enrolment",
  "Enrolment over time",
  "Employment trend",
  "Job placements",
];
export function DashboardChartBoard({ children }: { children?: ReactNode }) {
  const builtins = Children.toArray(children);
  const [saved, setSaved] = useState<SavedLayout | null>(null);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/dashboard/layout");
    if (!r.ok)
      throw new Error("Could not load your dashboard layout. Please refresh.");
    setSaved(await r.json());
  }, []);
  useEffect(() => {
    const refresh = () => {
      void load().catch((e) => setStatus(e.message));
    };
    const start = () => setDragging(true);
    const end = () => {
      setDragging(false);
      setHover("");
    };
    refresh();
    window.addEventListener("smit:charts-changed", refresh);
    window.addEventListener("smit:chart-drag", start);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.removeEventListener("smit:charts-changed", refresh);
      window.removeEventListener("smit:chart-drag", start);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, [load]);
  const change = async (mutation: LayoutChange) => {
    if (locked.current || !saved) return;
    locked.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/dashboard/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mutation, revision: saved.revision }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save layout.");
      await load();
      setStatus(
        mutation.action === "remove"
          ? "Chart removed. Layout saved."
          : "Dashboard layout saved.",
      );
    } catch (e) {
      setStatus((e as Error).message);
      await load().catch(() => {});
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const title = (id: string) =>
    names[defaultChartIds.indexOf(id)] ??
    saved?.charts.find((c) => c.id === id)?.title ??
    "Chart";
  const over = (event: DragEvent, key: string) => {
    if (!event.dataTransfer.types.includes(CHART_DRAG_TYPE) || busy) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setHover(key);
  };
  const drop = (
    event: DragEvent,
    target?: string,
    placement: "before" | "replace" = "before",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer.getData(CHART_DRAG_TYPE);
    setDragging(false);
    setHover("");
    if (/^[a-f0-9]{24}$/i.test(id) || defaultChartIds.includes(id))
      void change({ id, action: "move", target, placement });
  };
  if (!saved)
    return (
      <p role="status" className="mt-8 text-sm text-ink-muted">
        {status || "Loading charts?"}
      </p>
    );
  return (
    <div className="mt-8" aria-label="Dashboard charts" aria-busy={busy}>
      {status && (
        <p role="status" className="mb-2 text-xs text-ink-muted">
          {status}
        </p>
      )}
      {dragging && (
        <p className="mb-3 text-sm text-brand-700">
          Drop on a chart to replace it. Drop between charts to insert it.
        </p>
      )}
      <div
        className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-2"
        onDragOver={(e) => over(e, "end")}
        onDrop={(e) => drop(e)}
      >
        {saved.items.map((id) => {
          const chart = saved.charts.find((c) => c.id === id);
          return (
            <div key={id} className="min-w-0" data-dashboard-chart={id}>
              <div
                aria-label={`Insert before ${title(id)}`}
                onDragOver={(e) => over(e, `before:${id}`)}
                onDrop={(e) => drop(e, id)}
                className={`flex items-center justify-center rounded-lg text-xs transition-all ${dragging ? "mb-2 h-10 border-2 border-dashed border-brand-300 text-brand-700" : "h-2"} ${hover === `before:${id}` ? "bg-brand-100" : ""}`}
              >
                {dragging ? "Insert chart here" : null}
              </div>
              <div
                onDragOver={(e) => over(e, id)}
                onDragLeave={() => setHover("")}
                onDrop={(e) => drop(e, id, "replace")}
                className={`relative rounded-2xl ${hover === id ? "ring-4 ring-brand-500" : ""}`}
              >
                <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-edge bg-surface px-3 py-2">
                  <button
                    type="button"
                    draggable={!busy}
                    aria-label={`Move ${title(id)}`}
                    title="Drag to move"
                    onDragStart={(e) => {
                      e.dataTransfer.setData(CHART_DRAG_TYPE, id);
                      e.dataTransfer.effectAllowed = "move";
                      window.dispatchEvent(new Event("smit:chart-drag"));
                    }}
                    className="cursor-grab rounded p-1 hover:bg-surface-muted"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <label className="flex flex-1 items-center gap-2 text-xs text-ink-muted">
                    Move to
                    <select
                      aria-label={`Move ${title(id)} to position`}
                      disabled={busy}
                      value={saved.items.indexOf(id)}
                      className="rounded border border-edge bg-surface p-1"
                      onChange={(e) => {
                        const index = Number(e.target.value);
                        const others = saved.items.filter(
                          (item) => item !== id,
                        );
                        void change({
                          id,
                          action: "move",
                          target: others[index],
                          placement: "before",
                        });
                      }}
                    >
                      {saved.items.map((_, i) => (
                        <option key={i} value={i}>
                          Position {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Delete ${title(id)} from dashboard`}
                    title="Delete from dashboard"
                    onClick={() => void change({ id, action: "remove" })}
                    className="rounded p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {chart ? (
                  <AiChart chart={chart} pinned />
                ) : (
                  builtins[defaultChartIds.indexOf(id)]
                )}
                {hover === id && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-brand-50/80 font-semibold text-brand-700">
                    Release to replace this chart
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {(dragging || saved.items.length === 0) && (
          <div
            aria-label="Add chart at end"
            onDragOver={(e) => over(e, "end")}
            onDrop={(e) => drop(e)}
            className={`flex min-h-24 items-center justify-center rounded-xl border-2 border-dashed border-edge p-4 text-sm text-ink-muted lg:col-span-2 ${hover === "end" ? "bg-brand-50" : ""}`}
          >
            Drop a chart here, or add one from the assistant.
          </div>
        )}
      </div>
    </div>
  );
}
