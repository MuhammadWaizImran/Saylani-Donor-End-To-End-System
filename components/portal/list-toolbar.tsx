"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** URL-driven search/filter/pagination state shared by every portal list
 *  page — updates the query string (server re-fetches the matching slice)
 *  inside a transition so the UI can show a "Searching…" state. */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  return { searchParams, setParams, isPending };
}

/** Debounced search box wired to a `useListParams` `setParams` — types
 *  update instantly, the URL (and server query) update 400ms after typing
 *  stops. Resets to page 1 on every search. */
export function useDebouncedSearch(
  initial: string,
  setParams: (updates: Record<string, string>) => void,
  paramKey = "q",
) {
  const [value, setValue] = useState(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParams({ [paramKey]: next, page: "" }), 400);
  };
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return { value, onChange };
}

/** Presentational search input — the parent owns debouncing + URL state
 *  (see students-table.tsx for the pattern), this just renders the markup
 *  so every list page doesn't re-implement the same icon + input. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <label className="sr-only">{label}</label>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-edge bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
      />
    </div>
  );
}

export function ResultsCount({
  isPending,
  total,
  page,
  pageSize,
  noun,
}: {
  isPending: boolean;
  total: number;
  page: number;
  pageSize: number;
  noun: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <p role="status" className={cn("mb-4 text-sm text-ink-muted", isPending && "animate-pulse")}>
      {isPending ? (
        "Searching…"
      ) : (
        <>
          Showing <span className="font-bold text-ink">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
          <span className="font-bold text-ink">{total.toLocaleString()}</span> {noun}
        </>
      )}
    </p>
  );
}

export function PaginationBar({
  page,
  totalPages,
  isPending,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  isPending: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1 || isPending}
        onClick={onPrev}
        className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors enabled:hover:border-brand-400 enabled:hover:text-brand-700 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Previous
      </button>
      <span className="text-sm text-ink-muted">
        Page <span className="font-bold text-ink">{page.toLocaleString()}</span> of{" "}
        <span className="font-bold text-ink">{totalPages.toLocaleString()}</span>
      </span>
      <button
        type="button"
        disabled={page >= totalPages || isPending}
        onClick={onNext}
        className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors enabled:hover:border-brand-400 enabled:hover:text-brand-700 disabled:opacity-40"
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
