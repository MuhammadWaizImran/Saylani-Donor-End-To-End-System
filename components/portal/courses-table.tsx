"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Course, CourseStatus } from "@/types/management";
import { Pill, TableShell, Td, Th } from "@/components/portal/ui";
import {
  PaginationBar,
  ResultsCount,
  SearchInput,
  useDebouncedSearch,
  useListParams,
} from "@/components/portal/list-toolbar";
import { cn } from "@/lib/utils";

export interface EnrichedCourse extends Course {
  campusName: string;
  trainerName: string;
}

const statusTone: Record<CourseStatus, "green" | "gray" | "dark"> = {
  running: "green",
  completed: "dark",
  upcoming: "gray",
};

const statusLabel: Record<CourseStatus, string> = {
  running: "Running",
  completed: "Completed",
  upcoming: "Upcoming",
};

export function CoursesTable({
  courses,
  total,
  page,
  pageSize,
}: {
  courses: EnrichedCourse[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const { searchParams, setParams, isPending } = useListParams();
  const search = useDebouncedSearch(searchParams.get("q") ?? "", setParams);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search.value}
          onChange={search.onChange}
          label="Search courses"
          placeholder="Search by course name…"
        />
        <label htmlFor="filter-course-status" className="sr-only">Filter by status</label>
        <select
          id="filter-course-status"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => setParams({ status: e.target.value, page: "" })}
          className="rounded-xl border border-edge bg-surface px-3 py-2.5 text-sm font-medium text-ink focus:border-brand-500 focus:outline-none"
        >
          <option value="">Any status</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="upcoming">Upcoming</option>
        </select>
      </div>

      <ResultsCount isPending={isPending} total={total} page={page} pageSize={pageSize} noun="courses" />

      <TableShell minWidth={880}>
        <thead>
          <tr className="border-b border-edge bg-surface-muted">
            <Th>Course</Th>
            <Th>Campus</Th>
            <Th>Status</Th>
            <Th>Trainer</Th>
            <Th>Enrolled</Th>
            <Th>Duration</Th>
            <Th />
          </tr>
        </thead>
        <tbody className={cn("divide-y divide-edge", isPending && "opacity-50")}>
          {courses.map((c) => (
            <tr key={c.id} className="group cursor-pointer hover:bg-surface-muted/60">
              <Td>
                <Link href={`/portal/admin/courses/${c.id}`}>
                  <span className="font-semibold text-ink group-hover:text-brand-700">{c.name}</span>
                  <span className="block text-xs text-ink-muted">Started {c.startedAt}</span>
                </Link>
              </Td>
              <Td className="text-ink-muted">{c.campusName}</Td>
              <Td>
                <Pill tone={statusTone[c.status]}>{statusLabel[c.status]}</Pill>
              </Td>
              <Td className="text-ink-muted">{c.trainerName}</Td>
              <Td className="font-semibold text-ink">{c.enrolledCount}</Td>
              <Td className="text-ink-muted">{c.durationMonths > 0 ? `${c.durationMonths} months` : "—"}</Td>
              <Td>
                <Link
                  href={`/portal/admin/courses/${c.id}`}
                  aria-label={`View ${c.name} details`}
                  className="inline-flex text-ink-muted transition-colors group-hover:text-brand-700"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </Td>
            </tr>
          ))}
          {courses.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                No courses match your search.
              </td>
            </tr>
          )}
        </tbody>
      </TableShell>

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
