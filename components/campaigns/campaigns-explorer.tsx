"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Campaign } from "@/types";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { cn } from "@/lib/utils";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "urgent", label: "Urgent" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export function CampaignsExplorer({
  campaigns,
  categories,
  locations,
  initialStatus = "",
}: {
  campaigns: Campaign[];
  categories: string[];
  locations: string[];
  initialStatus?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  // The parent page passes `key={initialStatus}` so a URL change remounts
  // this component with fresh state — no sync effect needed.
  const [status, setStatus] = useState(initialStatus);
  const [location, setLocation] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (category && c.category !== category) return false;
      if (status && c.status !== status) return false;
      if (location && c.location !== location) return false;
      if (q && !`${c.title} ${c.tagline} ${c.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [campaigns, query, category, status, location]);

  const hasFilters = Boolean(query || category || status || location);

  const selectClass =
    "rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm font-medium text-ink focus:border-brand-500 focus:outline-none";

  return (
    <div>
      <div className="mb-8 rounded-2xl border border-edge bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <label htmlFor="campaign-search" className="sr-only">
              Search campaigns
            </label>
            <input
              id="campaign-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns…"
              className="w-full rounded-xl border border-edge bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SlidersHorizontal className="hidden h-4 w-4 text-ink-muted lg:block" aria-hidden />
            <label htmlFor="filter-category" className="sr-only">
              Filter by category
            </label>
            <select
              id="filter-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label htmlFor="filter-status" className="sr-only">
              Filter by urgency
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClass}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label htmlFor="filter-location" className="sr-only">
              Filter by location
            </label>
            <select
              id="filter-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={selectClass}
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setStatus("");
                  setLocation("");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950"
              >
                <X className="h-4 w-4" aria-hidden />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <p role="status" className="mb-5 text-sm text-ink-muted">
        Showing <span className="font-bold text-ink">{filtered.length}</span> of{" "}
        {campaigns.length} campaigns
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-surface-muted py-20 text-center">
          <p className="font-display text-lg font-bold text-ink">No campaigns match your filters</p>
          <p className="mt-1 text-sm text-ink-muted">Try a different search term or clear the filters.</p>
        </div>
      ) : (
        <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3")}>
          {filtered.map((campaign, i) => (
            <CampaignCard key={campaign.id} campaign={campaign} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
