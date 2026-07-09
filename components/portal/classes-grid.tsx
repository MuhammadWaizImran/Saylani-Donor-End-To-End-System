"use client";

import { CalendarClock, Users } from "lucide-react";
import type { ActiveClass } from "@/types/management";
import {
  PaginationBar,
  ResultsCount,
  SearchInput,
  useDebouncedSearch,
  useListParams,
} from "@/components/portal/list-toolbar";
import { cn } from "@/lib/utils";

export interface EnrichedClass extends ActiveClass {
  campusName: string;
  trainerName: string;
  courseName: string;
}

export function ClassesGrid({
  classes,
  total,
  page,
  pageSize,
}: {
  classes: EnrichedClass[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const { searchParams, setParams, isPending } = useListParams();
  const search = useDebouncedSearch(searchParams.get("q") ?? "", setParams);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-5">
        <SearchInput
          value={search.value}
          onChange={search.onChange}
          label="Search active classes"
          placeholder="Search by section name…"
        />
      </div>

      <ResultsCount isPending={isPending} total={total} page={page} pageSize={pageSize} noun="active classes" />

      <div className={cn("grid gap-5 md:grid-cols-2 xl:grid-cols-3", isPending && "opacity-50")}>
        {classes.map((cls) => (
          <article key={cls.id} className="portal-glow rounded-2xl border border-edge bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-800">
                Live batch
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                <Users className="h-3.5 w-3.5 text-accent-600" aria-hidden />
                {cls.studentCount} students
              </span>
            </div>
            <h2 className="mt-4 font-display text-2xl text-black">{cls.name}</h2>
            <p className="mt-1 text-sm text-ink-muted">{cls.courseName}</p>

            <dl className="mt-5 space-y-2 border-t border-edge pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Campus</dt>
                <dd className="font-semibold text-ink">{cls.campusName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Trainer</dt>
                <dd className="font-semibold text-ink">{cls.trainerName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Timing</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-ink">
                  <CalendarClock className="h-3.5 w-3.5 text-accent-600" aria-hidden />
                  {cls.timing}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        {classes.length === 0 && (
          <p className="col-span-full py-12 text-center text-ink-muted">No active classes match your search.</p>
        )}
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        isPending={isPending}
        onPrev={() => setParams({ page: String(page - 1) })}
        onNext={() => setParams({ page: String(page + 1) })}
      />
    </>
  );
}
