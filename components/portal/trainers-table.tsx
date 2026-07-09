"use client";

import type { Trainer } from "@/types/management";
import { Avatar, MiniProgress, TableShell, Td, Th } from "@/components/portal/ui";
import {
  PaginationBar,
  ResultsCount,
  SearchInput,
  useDebouncedSearch,
  useListParams,
} from "@/components/portal/list-toolbar";
import { cn, formatCurrency } from "@/lib/utils";

export interface EnrichedTrainer extends Trainer {
  campusName: string;
}

export function TrainersTable({
  trainers,
  total,
  page,
  pageSize,
}: {
  trainers: EnrichedTrainer[];
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
          label="Search trainers"
          placeholder="Search by name, email, or specialization…"
        />
      </div>

      <ResultsCount isPending={isPending} total={total} page={page} pageSize={pageSize} noun="trainers" />

      <TableShell minWidth={920}>
        <thead>
          <tr className="border-b border-edge bg-surface-muted">
            <Th>Trainer</Th>
            <Th>Campus</Th>
            <Th>Specialization</Th>
            <Th>Salary</Th>
            <Th>Students</Th>
            <Th>Batches</Th>
            <Th>Placed</Th>
            <Th>Performance</Th>
          </tr>
        </thead>
        <tbody className={cn("divide-y divide-edge", isPending && "opacity-50")}>
          {trainers.map((t) => (
            <tr key={t.id} className="hover:bg-surface-muted/60">
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} />
                  <div>
                    <p className="font-semibold text-ink">{t.name}</p>
                    <p className="text-xs text-ink-muted">{t.email}</p>
                  </div>
                </div>
              </Td>
              <Td className="text-ink-muted">{t.campusName}</Td>
              <Td className="text-ink-muted">{t.specialization}</Td>
              <Td>
                <span className="font-semibold text-ink">{formatCurrency(t.salary)}</span>
                <span className="block text-xs text-ink-muted">per month</span>
              </Td>
              <Td className="font-semibold text-ink">{t.studentCount}</Td>
              <Td className="font-semibold text-ink">{t.batchesCount}</Td>
              <Td>
                <span className="font-bold text-accent-700">{t.placedCount}</span>
              </Td>
              <Td>
                <MiniProgress percent={t.performancePercent} />
              </Td>
            </tr>
          ))}
          {trainers.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                No trainers match your search.
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
