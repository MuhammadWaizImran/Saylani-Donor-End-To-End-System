"use client";

import type { Student } from "@/types/management";
import { Avatar, MiniProgress, Pill, TableShell, Td, Th } from "@/components/portal/ui";
import {
  PaginationBar,
  ResultsCount,
  SearchInput,
  useDebouncedSearch,
  useListParams,
} from "@/components/portal/list-toolbar";
import { cn, formatCurrency } from "@/lib/utils";

export interface EnrichedStudent extends Student {
  campusName: string;
  courseName: string;
  trainerName: string;
}

const selectClass =
  "rounded-xl border border-edge bg-white px-3 py-2.5 text-sm font-medium text-ink focus:border-brand-500 focus:outline-none";

/**
 * Server-driven table: filters/search/page live in the URL, the server
 * queries only the requested slice — scales to millions of rows.
 */
export function StudentsTable({
  students,
  campuses,
  total,
  page,
  pageSize,
}: {
  students: EnrichedStudent[];
  campuses: Array<{ id: string; name: string }>;
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
          label="Search students"
          placeholder="Search by name, roll no. (email), or company…"
        />
        <div className="flex flex-wrap gap-3">
          <label htmlFor="filter-campus" className="sr-only">Filter by campus</label>
          <select
            id="filter-campus"
            value={searchParams.get("campus") ?? ""}
            onChange={(e) => setParams({ campus: e.target.value, page: "" })}
            className={selectClass}
          >
            <option value="">All campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label htmlFor="filter-enrollment" className="sr-only">Filter by enrollment status</label>
          <select
            id="filter-enrollment"
            value={searchParams.get("status") ?? ""}
            onChange={(e) => setParams({ status: e.target.value, page: "" })}
            className={selectClass}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <label htmlFor="filter-placement" className="sr-only">Filter by placement</label>
          <select
            id="filter-placement"
            value={searchParams.get("placement") ?? ""}
            onChange={(e) => setParams({ placement: e.target.value, page: "" })}
            className={selectClass}
          >
            <option value="">Any placement</option>
            <option value="placed">Placed</option>
            <option value="seeking">Seeking job</option>
            <option value="studying">Studying</option>
          </select>
        </div>
      </div>

      <ResultsCount isPending={isPending} total={total} page={page} pageSize={pageSize} noun="student profiles" />

      <TableShell minWidth={980}>
        <thead>
          <tr className="border-b border-edge bg-surface-muted">
            <Th>Student</Th>
            <Th>Campus</Th>
            <Th>Course</Th>
            <Th>Trainer</Th>
            <Th>Status</Th>
            <Th>Progress</Th>
            <Th>Attendance</Th>
            <Th>Placement</Th>
          </tr>
        </thead>
        <tbody className={cn("divide-y divide-edge", isPending && "opacity-50")}>
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-surface-muted/60">
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} />
                  <div>
                    <p className="font-semibold text-ink">{s.name}</p>
                    <p className="text-xs text-ink-muted">{s.email}</p>
                    <p className="text-xs text-ink-muted">{s.phone}</p>
                  </div>
                </div>
              </Td>
              <Td className="text-ink-muted">{s.campusName}</Td>
              <Td className="text-ink-muted">{s.courseName}</Td>
              <Td className="text-ink-muted">{s.trainerName}</Td>
              <Td>
                <Pill tone={s.enrollmentStatus === "active" ? "green" : "red"}>
                  {s.enrollmentStatus === "active" ? "Active" : "Inactive"}
                </Pill>
              </Td>
              <Td>
                <MiniProgress percent={s.progressPercent} />
              </Td>
              <Td>
                <span className="font-semibold text-ink">{s.attendancePercent}%</span>
              </Td>
              <Td>
                {s.placementStatus === "placed" ? (
                  <div>
                    <Pill tone="dark">Placed</Pill>
                    <p className="mt-1 text-xs font-semibold text-ink">{s.company}</p>
                    <p className="text-xs text-brand-700">{formatCurrency(s.salary ?? 0)}/mo</p>
                  </div>
                ) : s.placementStatus === "seeking" ? (
                  <Pill tone="amber">Seeking job</Pill>
                ) : (
                  <Pill tone="gray">Studying</Pill>
                )}
              </Td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                No students match your filters.
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
