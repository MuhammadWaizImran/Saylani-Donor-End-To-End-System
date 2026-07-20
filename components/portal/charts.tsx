"use client";

import { useEffect, useRef, useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import {
  CHART_AXIS_INK as AXIS_INK,
  CHART_GRID as GRID,
  CHART_SURFACE as SURFACE,
  SERIES_1,
  SERIES_2,
} from "@/lib/chart-palette";
import { cn, formatCompact, formatCurrency } from "@/lib/utils";

/**
 * Hand-rolled SVG charts for the portal. Colours come from
 * lib/chart-palette.ts — see that file for the validation record.
 */

/**
 * How a chart formats its numbers. A plain string, not a callback: these are
 * client components rendered from server components, and a function prop
 * can't cross that boundary.
 */
export type ValueFormat = "currency" | "compact" | "number";

function fmt(v: number, f: ValueFormat): string {
  if (f === "currency") return formatCurrency(v);
  if (f === "compact") return formatCompact(v);
  return Math.round(v).toLocaleString();
}

const BAR_MAX = 24; // marks stay thin — never fill the band
const RADIUS = 4; // rounded data-end, square at the baseline
const STACK_GAP = 2; // surface gap between touching segments

/* ── geometry helpers ──────────────────────────────────────── */

/** Round a max up to clean axis ticks (0 / 1,000 / 2,000 …). */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** A bar with a rounded data-end and a square baseline end. */
function barPath(x: number, y: number, w: number, h: number, round: boolean) {
  if (h <= 0.5) return "";
  if (!round) return `M${x},${y} h${w} v${h} h${-w} Z`;
  const r = Math.min(RADIUS, h, w / 2);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/** Rough glyph width for this app's 11px sans body text — used only to
 *  decide how many characters of an axis label fit in a given band, never
 *  for exact layout. */
const CHAR_PX = 6.3;

/** Shortens a label to whatever fits `widthPx` at ~11px, appending "…". The
 *  full name is unaffected everywhere else (tooltip, table, aria-label) —
 *  this only protects the axis tick itself from overlapping its neighbours,
 *  which a caller-side fixed-length truncation can't guarantee once the
 *  chart ends up in a narrower column than it was tuned for. */
function truncateToWidth(label: string, widthPx: number): string {
  const maxChars = Math.max(1, Math.floor(widthPx / CHAR_PX));
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** Measures the container so the chart can size itself to the card. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ── card shell: title, legend, chart ⇄ table toggle ────────── */

export interface LegendItem {
  label: string;
  color: string;
}

/**
 * Wraps a chart with its title and a table view of the same numbers, so no
 * value is ever reachable only by hovering.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Omit for single-series charts — the title already names the series. */
  legend?: LegendItem[];
  table: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const headingId = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section aria-labelledby={headingId} className="portal-glow rounded-2xl border border-edge bg-surface p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="font-display text-xl text-ink-strong">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {legend && legend.length > 1 && (
            <ul className="flex flex-wrap items-center gap-3">
              {legend.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                  {l.label}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            title={showTable ? "Show chart" : "Show data table"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-700"
          >
            {showTable ? <BarChart3 className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
            <span className="sr-only">{showTable ? "Show chart" : "Show data table"}</span>
          </button>
        </div>
      </div>
      {showTable ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

/** The table twin's shared markup. */
export function ChartTable({ head, rows }: { head: string[]; rows: Array<Array<string>> }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-edge">
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={cn(
                "whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink-muted",
                i > 0 && "text-right",
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-edge">
        {rows.map((r) => (
          <tr key={r[0]}>
            {r.map((cell, i) => (
              <td
                key={i}
                className={cn(
                  "whitespace-nowrap px-3 py-2",
                  i === 0 ? "font-semibold text-ink" : "text-right tabular-nums text-ink",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── tooltip ───────────────────────────────────────────────── */

function Tooltip({
  x,
  title,
  rows,
}: {
  /** Horizontal position as a percentage of the plot width. */
  x: number;
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-xl border border-edge bg-surface px-3 py-2 shadow-lg"
      style={{ left: `${Math.min(88, Math.max(12, x))}%` }}
    >
      <p className="whitespace-nowrap text-xs font-bold text-ink">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 whitespace-nowrap text-xs text-ink-muted">
            {r.color && <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
            <span className="ml-auto font-bold tabular-nums text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── column chart (1 or 2 stacked series) ──────────────────── */

export interface ColumnDatum {
  label: string;
  fullLabel: string;
  /** One value per series, in the same order as `series`. */
  values: number[];
}

export function ColumnChart({
  data,
  series,
  format = "number",
}: {
  data: ColumnDatum[];
  series: Array<{ label: string; color: string }>;
  format?: ValueFormat;
}) {
  const formatValue = (v: number) => fmt(v, format);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const PAD_L = 60;
  const PAD_R = 12;
  const PAD_T = 8;
  const PAD_B = 34; // the x-axis band lives inside the box — never clipped
  const PLOT_H = 210;
  const H = PAD_T + PLOT_H + PAD_B;

  // The per-item width budget grows with how long the labels actually are
  // (month ticks like "Jan 25" need far less room than a course name) —
  // capped so one very long label can't blow the chart out, since the axis
  // tick itself is truncated to fit below regardless.
  const maxLabelLen = Math.max(...data.map((d) => d.label.length), 1);
  const perItemPx = Math.max(34, Math.min(90, maxLabelLen * CHAR_PX + 10));

  const minW = PAD_L + PAD_R + data.length * perItemPx;
  const W = Math.max(minW, width || minW);
  const plotW = W - PAD_L - PAD_R;
  const band = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(BAR_MAX, band * 0.62);

  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const ticks = niceTicks(Math.max(...totals, 0));
  const maxTick = ticks[ticks.length - 1] || 1;
  const yOf = (v: number) => PAD_T + PLOT_H - (v / maxTick) * PLOT_H;

  const stride = Math.max(1, Math.ceil((data.length * perItemPx) / Math.max(plotW, 1)));

  return (
    <div ref={ref} className="relative">
      <div className="overflow-x-auto">
        <svg width={W} height={H} role="img" aria-label={`Column chart: ${series.map((s) => s.label).join(" and ")}`}>
          {/* gridlines + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={PAD_L - 8}
                y={yOf(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill={AXIS_INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatValue(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD_L + band * i + band / 2;
            const x = cx - barW / 2;
            const total = totals[i];
            let cursor = PAD_T + PLOT_H; // grow up from the baseline
            return (
              <g key={d.label}>
                {d.values.map((v, si) => {
                  if (v <= 0) return null;
                  const isTop = d.values.slice(si + 1).every((rest) => rest <= 0);
                  const rawH = (v / maxTick) * PLOT_H;
                  // The 2px surface gap between touching segments comes out of
                  // the lower segment, so the stack total stays truthful.
                  const gap = si > 0 || !isTop ? STACK_GAP : 0;
                  const h = Math.max(0, rawH - (isTop ? 0 : gap));
                  const y = cursor - rawH;
                  cursor -= rawH;
                  return (
                    <path
                      key={si}
                      d={barPath(x, y + (isTop ? 0 : gap), barW, h, isTop)}
                      fill={series[si].color}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  );
                })}
                {/* x label — truncated to whatever actually fits this band,
                    so a narrow column can never make neighbouring labels
                    overlap; the full name is still on hover and in the table. */}
                {i % stride === 0 && (
                  <text x={cx} y={H - 12} textAnchor="middle" fontSize={11} fill={AXIS_INK}>
                    {truncateToWidth(d.label, band)}
                  </text>
                )}
                {/* hit area — wider than the mark */}
                <rect
                  x={PAD_L + band * i}
                  y={PAD_T}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.fullLabel}: ${series
                    .map((s, si) => `${s.label} ${formatValue(d.values[si])}`)
                    .join(", ")}${series.length > 1 ? `, total ${formatValue(total)}` : ""}`}
                  className="cursor-pointer outline-none focus-visible:fill-brand-50"
                />
              </g>
            );
          })}

          {/* baseline */}
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke={GRID} strokeWidth={1} />
        </svg>
      </div>

      {hover !== null && data[hover] && (
        <Tooltip
          x={((PAD_L + band * hover + band / 2) / W) * 100}
          title={data[hover].fullLabel}
          rows={[
            ...series.map((s, si) => ({
              label: s.label,
              value: formatValue(data[hover].values[si]),
              color: s.color,
            })),
            ...(series.length > 1
              ? [{ label: "Total", value: formatValue(totals[hover]) }]
              : []),
          ]}
        />
      )}
    </div>
  );
}

/* ── trend area (single series) ────────────────────────────── */

export function TrendArea({
  data,
  format = "number",
  color = SERIES_1,
}: {
  data: Array<{ label: string; fullLabel: string; value: number }>;
  format?: ValueFormat;
  color?: string;
}) {
  const formatValue = (v: number) => fmt(v, format);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const PAD_L = 48;
  const PAD_R = 14;
  const PAD_T = 8;
  const PAD_B = 34;
  const PLOT_H = 210;
  const H = PAD_T + PLOT_H + PAD_B;

  const minW = PAD_L + PAD_R + data.length * 30;
  const W = Math.max(minW, width || minW);
  const plotW = W - PAD_L - PAD_R;

  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 0));
  const maxTick = ticks[ticks.length - 1] || 1;
  const xOf = (i: number) => (data.length === 1 ? PAD_L + plotW / 2 : PAD_L + (i / (data.length - 1)) * plotW);
  const yOf = (v: number) => PAD_T + PLOT_H - (v / maxTick) * PLOT_H;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(d.value)}`).join(" ");
  const area = data.length
    ? `${line} L${xOf(data.length - 1)},${PAD_T + PLOT_H} L${xOf(0)},${PAD_T + PLOT_H} Z`
    : "";
  const stride = Math.max(1, Math.ceil((data.length * 38) / Math.max(plotW, 1)));
  const last = data.length - 1;

  return (
    <div ref={ref} className="relative">
      <div className="overflow-x-auto">
        <svg width={W} height={H} role="img" aria-label="Trend over time">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={PAD_L - 8}
                y={yOf(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill={AXIS_INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatValue(t)}
              </text>
            </g>
          ))}

          {/* area wash at ~10%, then the 2px line */}
          <path d={area} fill={color} opacity={0.1} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* crosshair */}
          {hover !== null && (
            <line
              x1={xOf(hover)}
              x2={xOf(hover)}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              stroke={GRID}
              strokeWidth={1}
            />
          )}

          {/* end marker — the one point worth labelling directly */}
          {last >= 0 && (
            <>
              <circle cx={xOf(last)} cy={yOf(data[last].value)} r={4} fill={color} stroke={SURFACE} strokeWidth={2} />
              <text
                x={xOf(last)}
                y={yOf(data[last].value) - 12}
                textAnchor="end"
                fontSize={11}
                fontWeight={700}
                fill={AXIS_INK}
              >
                {formatValue(data[last].value)}
              </text>
            </>
          )}

          {/* hovered point */}
          {hover !== null && (
            <circle
              cx={xOf(hover)}
              cy={yOf(data[hover].value)}
              r={4}
              fill={color}
              stroke={SURFACE}
              strokeWidth={2}
            />
          )}

          {data.map((d, i) => (
            <g key={d.label}>
              {i % stride === 0 && (
                <text x={xOf(i)} y={H - 12} textAnchor="middle" fontSize={11} fill={AXIS_INK}>
                  {d.label}
                </text>
              )}
              <rect
                x={xOf(i) - Math.max(12, plotW / Math.max(data.length, 1) / 2)}
                y={PAD_T}
                width={Math.max(24, plotW / Math.max(data.length, 1))}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${d.fullLabel}: ${formatValue(d.value)}`}
                className="cursor-pointer outline-none"
              />
            </g>
          ))}

          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke={GRID} strokeWidth={1} />
        </svg>
      </div>

      {hover !== null && data[hover] && (
        <Tooltip
          x={(xOf(hover) / W) * 100}
          title={data[hover].fullLabel}
          rows={[{ label: "Count", value: formatValue(data[hover].value), color }]}
        />
      )}
    </div>
  );
}

/* ── two-series trend (area + line) ────────────────────────── */

/**
 * Two lines sharing one time axis — a primary series with an area wash (the
 * "main" quantity, e.g. enrolments) and a secondary line over it (e.g.
 * dropouts). Both share the same y-scale so their relative size is honest.
 */
export function MultiTrendArea({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = SERIES_1,
  secondaryColor = SERIES_2,
  format = "number",
}: {
  data: Array<{ label: string; fullLabel: string; primary: number; secondary: number }>;
  primaryLabel: string;
  secondaryLabel: string;
  primaryColor?: string;
  secondaryColor?: string;
  format?: ValueFormat;
}) {
  const formatValue = (v: number) => fmt(v, format);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const PAD_L = 48;
  const PAD_R = 14;
  const PAD_T = 8;
  const PAD_B = 34;
  const PLOT_H = 210;
  const H = PAD_T + PLOT_H + PAD_B;

  const minW = PAD_L + PAD_R + data.length * 30;
  const W = Math.max(minW, width || minW);
  const plotW = W - PAD_L - PAD_R;

  const maxVal = Math.max(...data.map((d) => Math.max(d.primary, d.secondary)), 0);
  const ticks = niceTicks(maxVal);
  const maxTick = ticks[ticks.length - 1] || 1;
  const xOf = (i: number) => (data.length === 1 ? PAD_L + plotW / 2 : PAD_L + (i / (data.length - 1)) * plotW);
  const yOf = (v: number) => PAD_T + PLOT_H - (v / maxTick) * PLOT_H;

  const lineOf = (key: "primary" | "secondary") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(d[key])}`).join(" ");
  const primaryLine = lineOf("primary");
  const secondaryLine = lineOf("secondary");
  const primaryArea = data.length
    ? `${primaryLine} L${xOf(data.length - 1)},${PAD_T + PLOT_H} L${xOf(0)},${PAD_T + PLOT_H} Z`
    : "";
  const stride = Math.max(1, Math.ceil((data.length * 38) / Math.max(plotW, 1)));

  return (
    <div ref={ref} className="relative">
      <div className="overflow-x-auto">
        <svg width={W} height={H} role="img" aria-label={`Trend: ${primaryLabel} vs ${secondaryLabel}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={PAD_L - 8}
                y={yOf(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill={AXIS_INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatValue(t)}
              </text>
            </g>
          ))}

          <path d={primaryArea} fill={primaryColor} opacity={0.1} />
          <path d={primaryLine} fill="none" stroke={primaryColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={secondaryLine} fill="none" stroke={secondaryColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hover !== null && (
            <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD_T} y2={PAD_T + PLOT_H} stroke={GRID} strokeWidth={1} />
          )}

          {hover !== null && (
            <>
              <circle cx={xOf(hover)} cy={yOf(data[hover].primary)} r={4} fill={primaryColor} stroke={SURFACE} strokeWidth={2} />
              <circle cx={xOf(hover)} cy={yOf(data[hover].secondary)} r={4} fill={secondaryColor} stroke={SURFACE} strokeWidth={2} />
            </>
          )}

          {data.map((d, i) => (
            <g key={d.label}>
              {i % stride === 0 && (
                <text x={xOf(i)} y={H - 12} textAnchor="middle" fontSize={11} fill={AXIS_INK}>
                  {d.label}
                </text>
              )}
              <rect
                x={xOf(i) - Math.max(12, plotW / Math.max(data.length, 1) / 2)}
                y={PAD_T}
                width={Math.max(24, plotW / Math.max(data.length, 1))}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${d.fullLabel}: ${primaryLabel} ${formatValue(d.primary)}, ${secondaryLabel} ${formatValue(d.secondary)}`}
                className="cursor-pointer outline-none"
              />
            </g>
          ))}

          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke={GRID} strokeWidth={1} />
        </svg>
      </div>

      {hover !== null && data[hover] && (
        <Tooltip
          x={(xOf(hover) / W) * 100}
          title={data[hover].fullLabel}
          rows={[
            { label: primaryLabel, value: formatValue(data[hover].primary), color: primaryColor },
            { label: secondaryLabel, value: formatValue(data[hover].secondary), color: secondaryColor },
          ]}
        />
      )}
    </div>
  );
}

/* ── donut / ring (part-to-whole, ≤4 categories) ───────────────
 * A ring with the headline total in the centre — the right form when a
 * single total IS the story and it splits into a small, fixed number of
 * named parts (here: enrolled / certified / dropout). Colour is assigned by
 * meaning (see DONUT_* in chart-palette.ts), not by position, and both the
 * light and dark triples are validator-passed. Hovering a segment swaps the
 * centre figure to that segment's own value — the chart's whole "hover
 * effect", since a circular form has no natural x-axis for a crosshair. */

const DONUT_GAP_DEG = 3; // angular breathing room between touching segments
const DONUT_POP = 7; // px the hovered segment's outer edge grows by

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Path for one ring wedge: outer arc, in to the inner radius, inner arc back. */
function donutWedgePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  const p0 = polarPoint(cx, cy, rOuter, a0);
  const p1 = polarPoint(cx, cy, rOuter, a1);
  const p2 = polarPoint(cx, cy, rInner, a1);
  const p3 = polarPoint(cx, cy, rInner, a0);
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  centerLabel,
  format = "number",
}: {
  data: DonutDatum[];
  /** Sits under the total in the centre, e.g. "Students". */
  centerLabel: string;
  format?: ValueFormat;
}) {
  const formatValue = (v: number) => fmt(v, format);
  const [hover, setHover] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const nonZero = data.filter((d) => d.value > 0).length;

  const SIZE = 240;
  const C = SIZE / 2;
  const R_OUTER = 104;
  const R_INNER = 66;

  // Each wedge's start angle is the sum of every sweep before it — computed
  // fresh per item (no mutated running total) so this stays a pure render.
  const sweeps = data.map((d) => (total > 0 ? (d.value / total) * 360 : 0));
  const wedges = data.map((d, i) => {
    const start = sweeps.slice(0, i).reduce((a, b) => a + b, 0);
    const sweep = sweeps[i];
    const end = start + sweep;
    // No gap to carve out of a lone 100% segment or an empty one.
    const gap = sweep > 0 && nonZero > 1 ? Math.min(DONUT_GAP_DEG, sweep * 0.3) : 0;
    return { ...d, sweep, a0: start + gap / 2, a1: end - gap / 2 };
  });

  const hovered = hover !== null ? data[hover] : null;
  const centerValue = hovered ? hovered.value : total;
  const centerSub = hovered ? hovered.label : centerLabel;
  const centerColor = hovered ? hovered.color : undefined;

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`${centerLabel} breakdown: ${data.map((d) => `${d.label} ${formatValue(d.value)}`).join(", ")}, total ${formatValue(total)}`}
        >
          {wedges.map((w, i) =>
            w.sweep > 0 ? (
              <path
                key={w.label}
                d={donutWedgePath(C, C, hover === i ? R_OUTER + DONUT_POP : R_OUTER, R_INNER, w.a0, w.a1)}
                fill={w.color}
                opacity={hover === null || hover === i ? 1 : 0.45}
                tabIndex={0}
                role="button"
                aria-label={`${w.label}: ${formatValue(w.value)} (${Math.round((w.value / (total || 1)) * 100)}%)`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-pointer outline-none transition-[opacity] duration-150"
                style={{ transition: "opacity 150ms, d 150ms" }}
              >
                <title>{`${w.label}: ${formatValue(w.value)}`}</title>
              </path>
            ) : null,
          )}
        </svg>
        {/* Centre readout — swaps to the hovered segment's own figure. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display text-4xl font-bold tabular-nums text-ink-strong"
            style={centerColor ? { color: centerColor } : undefined}
          >
            {formatValue(centerValue)}
          </span>
          <span className="mt-0.5 max-w-[7rem] text-center text-xs font-semibold text-ink-muted">{centerSub}</span>
        </div>
      </div>
      {data.length === 0 || total === 0 ? (
        <p className="text-center text-sm text-ink-muted">No data yet.</p>
      ) : null}
    </div>
  );
}
