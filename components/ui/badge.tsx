import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/types";

export function CategoryBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:ring-brand-850",
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusStyles: Record<CampaignStatus, string> = {
  urgent:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900",
  active:
    "bg-accent-50 text-accent-700 ring-accent-200 dark:bg-accent-950 dark:text-accent-300 dark:ring-accent-900",
  completed:
    "bg-surface-muted text-ink-muted ring-edge",
};

const statusLabels: Record<CampaignStatus, string> = {
  urgent: "Urgent",
  active: "Active",
  completed: "Goal reached",
};

export function StatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        statusStyles[status],
        className,
      )}
    >
      {status === "urgent" && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
      )}
      {statusLabels[status]}
    </span>
  );
}
