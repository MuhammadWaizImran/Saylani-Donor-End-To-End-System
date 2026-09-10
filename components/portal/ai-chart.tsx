"use client";

import { useState } from "react";
import { GripVertical, Pin } from "lucide-react";
import { chartTypes, type ChartSpec } from "@/lib/ai/chart-spec";

export const CHART_DRAG_TYPE = "application/x-smit-chart";
export async function placeChart(
  id: string,
  action: "pin" | "move" | "remove" = "pin",
) {
  const res = await fetch("/api/dashboard/layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save chart");
  window.dispatchEvent(new Event("smit:charts-changed"));
}
const colors = [
  "#0b73b7",
  "#6da800",
  "#a855f7",
  "#ea580c",
  "#0891b2",
  "#e11d48",
  "#4f46e5",
  "#a16207",
];

export function AiChart({
  chart,
  pinned = false,
}: {
  chart: ChartSpec;
  pinned?: boolean;
}) {
  const [type, setType] = useState(chart.type);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = chart.rows;
  const min = Math.min(0, ...rows.map((r) => r.value));
  const max = Math.max(1, ...rows.map((r) => r.value));
  const y = (v: number) => 210 - ((v - min) / (max - min)) * 180;
  const x = (i: number) => 55 + ((i + 0.5) * 430) / rows.length;
  const trendPath = rows
    .map((r, i) => {
      if (i === 0) return `M${x(i)},${y(r.value)}`;
      const middle = (x(i - 1) + x(i)) / 2;
      return `C${middle},${y(rows[i - 1].value)} ${middle},${y(r.value)} ${x(i)},${y(r.value)}`;
    })
    .join(" ");
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const pieAllowed =
    rows.length <= 8 && rows.every((r) => r.value >= 0) && total > 0;
  return (
    <article
      className="min-w-0 rounded-xl border border-edge bg-surface p-3 text-left text-ink shadow-sm"
      aria-label={chart.title}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(CHART_DRAG_TYPE, chart.id);
            event.dataTransfer.effectAllowed = "copyMove";
            window.dispatchEvent(new Event("smit:chart-drag"));
          }}
          aria-label={`Drag ${chart.title} to dashboard`}
          title="Drag onto a dashboard chart to replace it, or between charts to insert"
          className="cursor-grab rounded-lg p-2 hover:bg-surface-muted active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <h4 className="min-w-0 flex-1 break-words text-sm font-bold">
          {chart.title}
        </h4>
        {!pinned && (
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await placeChart(chart.id);
                setStatus("Added to your dashboard");
              } catch (e) {
                setStatus((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-lg p-2 text-brand-700 hover:bg-brand-50"
            aria-label="Pin chart to dashboard"
            title="Pin to dashboard"
          >
            <Pin className="h-4 w-4" />
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        View
        <select
          aria-label={`Chart type for ${chart.title}`}
          value={type}
          onChange={(e) => setType(e.target.value as ChartSpec["type"])}
          className="rounded-md border border-edge bg-surface p-1 text-ink"
        >
          {chartTypes
            .filter((t) => t !== "pie" || pieAllowed)
            .map((t) => (
              <option key={t} value={t}>
                {
                  {
                    bar: "Bar",
                    line: "Line",
                    area: "Wave / area",
                    pie: "Circle / pie",
                    table: "Table",
                    flow: "Flow",
                  }[t]
                }
              </option>
            ))}
        </select>
        <span className="ml-auto truncate" title={chart.metric}>
          {chart.metric.replace(/_/g, " ")}
        </span>
      </label>
      {type === "table" ? (
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left">{chart.label}</th>
                <th className="text-right">{chart.metric}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-edge">
                  <td className="py-2">{r.label}</td>
                  <td className="text-right">{r.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : type === "flow" ? (
        <div className="mt-3 flex max-h-72 flex-wrap gap-2 overflow-auto">
          {rows.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs"
            >
              <strong>{r.label}</strong>
              <p>{r.value.toLocaleString()}</p>
            </div>
          ))}
          <p className="w-full text-xs text-ink-muted">
            Data overview; these categories do not establish a causal
            relationship.
          </p>
        </div>
      ) : (
        <svg
          viewBox="0 0 520 260"
          className="mt-3 w-full"
          role="img"
          aria-label={`${chart.title}: ${chart.metric} by ${chart.label}. Exact values available in table view.`}
        >
          {type !== "pie" && (
            <>
              {[min, (min + max) / 2, max].map((v, i) => (
                <g key={i}>
                  <line
                    x1="50"
                    x2="495"
                    y1={y(v)}
                    y2={y(v)}
                    stroke="currentColor"
                    opacity="0.12"
                  />
                  <text
                    x="44"
                    y={y(v) + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                  >
                    {Intl.NumberFormat("en", { notation: "compact" }).format(v)}
                  </text>
                </g>
              ))}
            </>
          )}
          {(type === "line" || type === "area") && (
            <>
              {type === "area" && (
                <path
                  d={`${trendPath} L${x(rows.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
                  fill={colors[0]}
                  opacity="0.15"
                />
              )}
              <path
                d={trendPath}
                fill="none"
                stroke={colors[0]}
                strokeWidth="3"
              />
            </>
          )}
          {rows.map((r, i) => {
            const tooltip = `${r.label}: ${r.value.toLocaleString()}`;
            const interaction = {
              tabIndex: 0,
              onMouseEnter: () => setSelected(i),
              onMouseLeave: () => setSelected(null),
              onFocus: () => setSelected(i),
              onBlur: () => setSelected(null),
              "aria-label": tooltip,
            };
            if (type === "pie") {
              const start =
                -Math.PI / 2 +
                (rows.slice(0, i).reduce((sum, row) => sum + row.value, 0) /
                  total) *
                  Math.PI *
                  2;
              const end = start + (r.value / total) * Math.PI * 2;
              const path = `M260,125 L${260 + 90 * Math.cos(start)},${125 + 90 * Math.sin(start)} A90,90 0 ${end - start > Math.PI ? 1 : 0} 1 ${260 + 90 * Math.cos(end)},${125 + 90 * Math.sin(end)} Z`;
              return r.value === total ? (
                <circle
                  key={i}
                  {...interaction}
                  cx="260"
                  cy="125"
                  r="90"
                  fill={colors[i % colors.length]}
                >
                  <title>{tooltip}</title>
                </circle>
              ) : (
                <path
                  key={i}
                  {...interaction}
                  d={path}
                  fill={colors[i % colors.length]}
                  stroke="var(--color-surface)"
                  strokeWidth="2"
                >
                  <title>{tooltip}</title>
                </path>
              );
            }
            return (
              <g key={i}>
                {type === "bar" ? (
                  <rect
                    {...interaction}
                    x={x(i) - Math.min(26, 320 / rows.length) / 2}
                    y={Math.min(y(0), y(r.value))}
                    width={Math.min(26, 320 / rows.length)}
                    height={Math.max(1, Math.abs(y(r.value) - y(0)))}
                    rx="3"
                    fill={colors[i % colors.length]}
                  >
                    <title>{tooltip}</title>
                  </rect>
                ) : (
                  <circle
                    {...interaction}
                    cx={x(i)}
                    cy={y(r.value)}
                    r="4"
                    fill={colors[0]}
                  >
                    <title>{tooltip}</title>
                  </circle>
                )}
                {(rows.length <= 8 || i % Math.ceil(rows.length / 8) === 0) && (
                  <text
                    x={x(i)}
                    y="237"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="9"
                  >
                    {r.label.length > 12 ? r.label.slice(0, 11) + "…" : r.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {type === "pie" && (
        <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {rows.map((row, index) => (
            <li key={row.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: colors[index % colors.length] }}
                aria-hidden
              />
              {row.label}: {row.value.toLocaleString()}
            </li>
          ))}
        </ul>
      )}
      <p className="min-h-5 text-xs font-semibold" aria-live="polite">
        {selected !== null
          ? `${rows[selected].label}: ${rows[selected].value.toLocaleString()}`
          : "Hover or focus a point for its value; choose table for all rows."}
      </p>
      <p className="mt-2 text-[10px] text-ink-muted">
        Snapshot · {new Date(chart.generatedAt).toLocaleString()} ·{" "}
        {rows.length} categories
      </p>
      <details className="mt-1 text-[10px] text-ink-muted">
        <summary>Data source and scope</summary>
        <p>
          {chart.source} · {chart.note}
        </p>
      </details>
      {status && (
        <p role="status" className="mt-2 text-xs text-brand-700">
          {status}
        </p>
      )}
    </article>
  );
}
