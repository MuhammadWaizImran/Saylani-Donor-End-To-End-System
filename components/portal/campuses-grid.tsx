"use client";

import { Building2, GraduationCap, School, Users } from "lucide-react";
import type { Campus } from "@/types/management";
import { MiniProgress } from "@/components/portal/ui";
import {
  PaginationBar,
  ResultsCount,
  SearchInput,
  useDebouncedSearch,
  useListParams,
} from "@/components/portal/list-toolbar";
import { cn } from "@/lib/utils";

export function CampusesGrid({
  campuses,
  total,
  page,
  pageSize,
}: {
  campuses: Campus[];
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
          label="Search campuses"
          placeholder="Search by campus name or city…"
        />
      </div>

      <ResultsCount isPending={isPending} total={total} page={page} pageSize={pageSize} noun="campuses" />

      <div className={cn("grid gap-5 md:grid-cols-2 xl:grid-cols-3", isPending && "opacity-50")}>
        {campuses.map((campus) => (
          <article key={campus.id} className="portal-glow flex flex-col rounded-2xl border border-edge bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-muted">
                Since {campus.established}
              </span>
            </div>
            <h2 className="mt-4 font-display text-2xl text-black">{campus.name}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {campus.address}, {campus.city}
            </p>

            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-edge pt-5 text-center">
              <div>
                <dt className="sr-only">Students</dt>
                <GraduationCap className="mx-auto h-4 w-4 text-accent-600" aria-hidden />
                <dd className="mt-1 text-sm font-bold text-ink">{campus.studentCount.toLocaleString()}</dd>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Students</p>
              </div>
              <div>
                <dt className="sr-only">Trainers</dt>
                <Users className="mx-auto h-4 w-4 text-accent-600" aria-hidden />
                <dd className="mt-1 text-sm font-bold text-ink">{campus.trainerCount}</dd>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Trainers</p>
              </div>
              <div>
                <dt className="sr-only">Courses</dt>
                <School className="mx-auto h-4 w-4 text-accent-600" aria-hidden />
                <dd className="mt-1 text-sm font-bold text-ink">{campus.courseCount}</dd>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Courses</p>
              </div>
            </dl>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-edge pt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Overall progress</p>
                <MiniProgress percent={campus.progressPercent} className="mt-1" />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Placement rate</p>
                <p className="font-display text-2xl text-accent-700">{campus.placementRate}%</p>
              </div>
            </div>
          </article>
        ))}
        {campuses.length === 0 && (
          <p className="col-span-full py-12 text-center text-ink-muted">No campuses match your search.</p>
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
