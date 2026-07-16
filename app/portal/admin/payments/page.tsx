import { CircleCheck, Clock, Receipt, Wallet } from "lucide-react";
import { getPaymentOverview } from "@/lib/management-api";
import { Avatar, Pill, PortalHeading, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { formatCompact, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Fee Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const o = await getPaymentOverview();
  const collectionRate =
    o.totalInvoices > 0 ? Math.round((o.paidCount / o.totalInvoices) * 100) : 0;

  return (
    <>
      <PortalHeading
        title="Fee payments,"
        accent="student billing"
        description="Monthly tuition invoices from the training system (Blinq / 1Bill) — read live from the database."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Total collected" value={formatCompact(o.totalCollected)} />
        <StatCard icon={Clock} label="Outstanding" value={formatCompact(o.totalPending)} />
        <StatCard
          icon={CircleCheck}
          label="Paid invoices"
          value={`${o.paidCount} / ${o.totalInvoices.toLocaleString()}`}
          sub={`${collectionRate}% collection rate`}
        />
        <StatCard icon={Receipt} label="Pending invoices" value={o.pendingCount.toLocaleString()} />
      </div>

      <section aria-labelledby="payments-heading" className="mt-10">
        <h2 id="payments-heading" className="mb-4 font-display text-xl text-black">
          Recent invoices
        </h2>
        {o.payments.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-white p-8 text-center text-sm text-ink-muted">
            No fee invoices in the database yet.
          </div>
        ) : (
          <TableShell minWidth={760}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Student</Th>
                <Th>Billing month</Th>
                <Th>Amount</Th>
                <Th>Type</Th>
                <Th>Due date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {o.payments.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.studentName} />
                      <span className="font-semibold text-ink">{p.studentName}</span>
                    </div>
                  </Td>
                  <Td>{p.billingMonth}</Td>
                  <Td>
                    <span className="font-bold text-ink">{formatCurrency(p.amount)}</span>
                  </Td>
                  <Td className="capitalize text-ink-muted">{p.type}</Td>
                  <Td>{p.dueDate || "—"}</Td>
                  <Td>
                    {p.status === "paid" ? (
                      <Pill tone="green">Paid</Pill>
                    ) : (
                      <Pill tone="amber">Pending</Pill>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {o.totalInvoices > o.payments.length && (
          <p className="mt-3 text-center text-sm text-ink-muted">
            Showing the {o.payments.length} most recent of {o.totalInvoices.toLocaleString()} invoices.
          </p>
        )}
      </section>
    </>
  );
}
