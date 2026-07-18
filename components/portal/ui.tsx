import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="portal-glow rounded-2xl border border-edge bg-surface p-5">
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="font-display text-3xl text-ink-strong">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

export function MiniProgress({ percent, className }: { percent: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-solid to-accent-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-ink">{clamped}%</span>
    </div>
  );
}

const pillStyles: Record<string, string> = {
  green: "bg-accent-50 text-accent-800 ring-accent-200",
  gray: "bg-surface-muted text-ink-muted ring-edge",
  dark: "bg-brand-50 text-brand-800 ring-brand-200",
  red: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-900",
  amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-900",
};

export function Pill({
  tone = "gray",
  children,
}: {
  tone?: keyof typeof pillStyles;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        pillStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PortalHeading({
  title,
  accent,
  description,
}: {
  title: string;
  accent?: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl tracking-tight text-ink-strong sm:text-4xl">
        {title}
        {accent && <em className="text-ink-muted"> {accent}</em>}
      </h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-ink-muted">{description}</p>}
    </div>
  );
}

/** Horizontal labeled bar list — used for campus-wise performance charts. */
export function BarList({
  items,
}: {
  items: Array<{ label: string; sub?: string; percent: number }>;
}) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{item.label}</span>
            <span className="text-xs text-ink-muted">
              {item.sub ? `${item.sub} · ` : ""}
              <span className="font-bold text-ink">{item.percent}%</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-solid to-accent-500"
              style={{ width: `${Math.min(100, item.percent)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TableShell({
  children,
  minWidth = 760,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="portal-glow overflow-x-auto rounded-2xl border border-edge bg-surface">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-ink-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3.5 align-middle", className)}>{children}</td>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-solid to-accent-500 text-xs font-bold text-white",
        className,
      )}
    >
      {name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
