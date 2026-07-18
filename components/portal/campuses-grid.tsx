"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, GraduationCap, School, Users } from "lucide-react";
import type { Campus } from "@/types/management";
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
          <Link
            key={campus.id}
            href={`/portal/admin/campuses/${campus.id}`}
            className="portal-glow group flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface transition-all hover:-translate-y-0.5"
          >
            <div className="relative h-32 w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-solid via-brand-500 to-accent-500">
              {campus.image ? (
                <Image src={campus.image} alt={campus.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Building2 className="h-9 w-9 text-white/40" aria-hidden />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl text-ink-strong">{campus.name}</h2>
                <span className="mt-1 shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-muted">
                  Since {campus.established || "—"}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {campus.address ? `${campus.address}, ` : ""}
                {campus.city}
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

              <span className="mt-5 flex items-center gap-1.5 border-t border-edge pt-4 text-xs font-semibold text-brand-700">
                View campus details
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </Link>
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
