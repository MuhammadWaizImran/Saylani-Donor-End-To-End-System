import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  GraduationCap,
  HeartHandshake,
  Mail,
  MapPin,
  Phone,
  Wallet,
} from "lucide-react";
import { getStudentDetail, resolveNames } from "@/lib/management-api";
import { Avatar, Pill, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { formatCompact, formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await getStudentDetail(id);
  return { title: student ? student.name : "Student" };
}

/** Renders a labelled fact, or an em-dash when the system doesn't have it. */
function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value || "—"}</dd>
    </div>
  );
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : dateFormatter.format(d);
};

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await getStudentDetail(id);
  if (!student) notFound();

  const [campusName, courseName, trainerName] = await Promise.all([
    resolveNames("campuses", [student.campusId]),
    resolveNames("courses", [student.courseId]),
    resolveNames("trainers", [student.trainerId]),
  ]);

  return (
    <>
      <Link
        href="/portal/admin/students"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All students
      </Link>

      {/* Profile header */}
      <div className="portal-glow rounded-2xl border border-edge bg-surface p-6">
        <div className="flex flex-wrap items-start gap-5">
          {student.image ? (
            <Image
              src={student.image}
              alt={student.name}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <Avatar name={student.name} className="h-20 w-20 rounded-2xl text-xl" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl text-ink-strong">{student.name}</h1>
              <Pill tone={student.enrollmentStatus === "active" ? "green" : "red"}>
                {student.enrollmentStatus === "active" ? "Active" : "Inactive"}
              </Pill>
              {student.isSponsored && <Pill tone="dark">Sponsored</Pill>}
            </div>
            <div className="mt-2 flex flex-col gap-1 text-sm text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
              {student.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {student.email}
                </span>
              )}
              {student.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {student.phone}
                </span>
              )}
              {student.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {student.address}
                </span>
              )}
            </div>
            {student.isSponsored && student.sponsorMessage && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-900">
                <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Sponsored — {student.sponsorMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Classes attended" value={student.classesAttended.toLocaleString()} />
        <StatCard
          icon={GraduationCap}
          label="Last attended"
          value={student.lastAttended ? timeAgo(student.lastAttended) : "—"}
        />
        <StatCard icon={Wallet} label="Fees paid" value={formatCompact(student.totalPaid)} />
        <StatCard
          icon={Wallet}
          label="Fees outstanding"
          value={formatCompact(student.totalPending)}
          sub={`${student.payments.length} invoice${student.payments.length === 1 ? "" : "s"}`}
        />
      </div>

      {/* Enrolment */}
      <section aria-labelledby="student-enrolment-heading" className="mt-10">
        <h2 id="student-enrolment-heading" className="mb-4 font-display text-xl text-ink-strong">
          Enrolment
        </h2>
        <dl className="portal-glow grid grid-cols-2 gap-5 rounded-2xl border border-edge bg-surface p-6 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Campus" value={campusName[student.campusId]} />
          <Fact label="Course" value={courseName[student.courseId]} />
          <Fact label="Trainer" value={trainerName[student.trainerId]} />
          <Fact label="Roll number" value={student.rollNumber} />
          <Fact label="Batch" value={student.batchNumber > 0 ? String(student.batchNumber) : ""} />
          <Fact label="Enrolled on" value={fmtDate(student.enrolledAt)} />
          <Fact label="Has laptop" value={student.laptop} />
        </dl>
      </section>

      {/* Personal */}
      <section aria-labelledby="student-personal-heading" className="mt-10">
        <h2 id="student-personal-heading" className="mb-4 font-display text-xl text-ink-strong">
          Personal details
        </h2>
        <dl className="portal-glow grid grid-cols-2 gap-5 rounded-2xl border border-edge bg-surface p-6 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Father's name" value={student.fatherName} />
          <Fact label="Gender" value={student.gender} />
          <Fact label="Date of birth" value={fmtDate(student.dateOfBirth)} />
          <Fact label="CNIC" value={student.cnic} />
          <Fact label="Last qualification" value={student.lastQualification} />
        </dl>
      </section>

      {/* Fee invoices */}
      <section aria-labelledby="student-fees-heading" className="mt-10">
        <h2 id="student-fees-heading" className="mb-4 font-display text-xl text-ink-strong">
          Fee invoices
        </h2>
        {student.payments.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No fee invoices recorded for this student.
          </div>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Billing month</Th>
                <Th>Amount</Th>
                <Th>Type</Th>
                <Th>Due date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {student.payments.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/60">
                  <Td className="font-semibold text-ink">{p.billingMonth}</Td>
                  <Td className="font-semibold text-ink">{formatCurrency(p.amount)}</Td>
                  <Td className="capitalize text-ink-muted">{p.type}</Td>
                  <Td>{p.dueDate || "—"}</Td>
                  <Td>{p.status === "paid" ? <Pill tone="green">Paid</Pill> : <Pill tone="amber">Pending</Pill>}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </>
  );
}
