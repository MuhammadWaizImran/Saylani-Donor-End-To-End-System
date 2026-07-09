"use client";

import type { Student } from "@/types/management";
import { Avatar, TableShell, Td, Th } from "@/components/portal/ui";
import {
  PaginationBar,
  ResultsCount,
  SearchInput,
  useDebouncedSearch,
  useListParams,
} from "@/components/portal/list-toolbar";
import { cn, formatCurrency } from "@/lib/utils";

export interface EnrichedPlacement extends Student {
  campusName: string;
  courseName: string;
  trainerName: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function JobsTable({
  placed,
  total,
  page,
  pageSize,
}: {
  placed: EnrichedPlacement[];
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
          label="Search placements"
          placeholder="Search by student name, roll no. (email), or company…"
        />
      </div>

      <ResultsCount isPending={isPending} total={total} page={page} pageSize={pageSize} noun="placements" />

      <TableShell minWidth={920}>
        <thead>
          <tr className="border-b border-edge bg-surface-muted">
            <Th>Student</Th>
            <Th>Campus</Th>
            <Th>Course completed</Th>
            <Th>Trainer</Th>
            <Th>Company</Th>
            <Th>Salary package</Th>
            <Th>Placed on</Th>
          </tr>
        </thead>
        <tbody className={cn("divide-y divide-edge", isPending && "opacity-50")}>
          {placed.map((s) => (
            <tr key={s.id} className="hover:bg-surface-muted/60">
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} />
                  <span className="font-semibold text-ink">{s.name}</span>
                </div>
              </Td>
              <Td className="text-ink-muted">{s.campusName}</Td>
              <Td className="text-ink-muted">{s.courseName}</Td>
              <Td className="text-ink-muted">{s.trainerName}</Td>
              <Td className="font-semibold text-ink">{s.company}</Td>
              <Td>
                <span className="font-bold text-brand-700">{formatCurrency(s.salary ?? 0)}</span>
                <span className="block text-xs text-ink-muted">per month</span>
              </Td>
              <Td className="whitespace-nowrap text-ink-muted">
                {s.placementDate ? dateFormatter.format(new Date(s.placementDate)) : "—"}
              </Td>
            </tr>
          ))}
          {placed.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                No placements match your search.
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
