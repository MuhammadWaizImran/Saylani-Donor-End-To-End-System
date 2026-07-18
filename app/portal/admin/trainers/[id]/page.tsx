import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  AlarmClock,
  ArrowLeft,
  Banknote,
  Clock,
  ExternalLink,
  GraduationCap,
  Layers,
  Mail,
  Phone,
  UserCheck,
} from "lucide-react";
import {
  getCoursesByTrainer,
  getTrainerDetail,
  resolveNames,
  searchStudents,
} from "@/lib/management-api";
import { Avatar, Pill, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trainer = await getTrainerDetail(id);
  return { title: trainer ? trainer.name : "Trainer" };
}

const statusTone = { running: "green", completed: "dark", upcoming: "gray" } as const;

/** Minutes → compact "Xh Ym". */
function formatDuration(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trainer = await getTrainerDetail(id);
  if (!trainer) notFound();

  const [courses, studentPage] = await Promise.all([
    getCoursesByTrainer(id),
    searchStudents({ trainerId: id, pageSize: 50 }),
  ]);

  const [campusName, courseName] = await Promise.all([
    resolveNames("campuses", trainer.campusIds),
    resolveNames("courses", studentPage.students.map((s) => s.courseId)),
  ]);

  return (
    <>
      <Link
        href="/portal/admin/trainers"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All trainers
      </Link>

      {/* Profile header */}
      <div className="portal-glow rounded-2xl border border-edge bg-surface p-6">
        <div className="flex flex-wrap items-start gap-5">
          {trainer.image ? (
            <Image
              src={trainer.image}
              alt={trainer.name}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <Avatar name={trainer.name} className="h-20 w-20 rounded-2xl text-xl" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl text-ink-strong">{trainer.name}</h1>
              {trainer.employeeId && <Pill tone="gray">Employee #{trainer.employeeId}</Pill>}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {trainer.specialization}
              {trainer.joinedAt ? ` · Joined ${trainer.joinedAt}` : ""}
            </p>
            <div className="mt-2 flex flex-col gap-1 text-sm text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
              {trainer.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {trainer.email}
                </span>
              )}
              {trainer.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {trainer.phone}
                </span>
              )}
            </div>

            {trainer.campusIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {trainer.campusIds.map((cid) => (
                  <Pill key={cid} tone="dark">
                    {campusName[cid] ?? "—"}
                  </Pill>
                ))}
              </div>
            )}

            {trainer.socialLinks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {trainer.socialLinks.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    {l.name}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Banknote} label="Hourly rate" value={formatCurrency(trainer.salary)} sub="per hour" />
        <StatCard icon={GraduationCap} label="Students" value={trainer.studentCount.toLocaleString()} />
        <StatCard icon={Layers} label="Class slots" value={trainer.batchesCount.toLocaleString()} />
        <StatCard
          icon={UserCheck}
          label="Check-ins"
          value={trainer.sessions.toLocaleString()}
          sub={trainer.lastCheckIn ? `last ${timeAgo(trainer.lastCheckIn)}` : "none logged"}
        />
        <StatCard icon={Clock} label="Time on campus" value={formatDuration(trainer.totalMinutes)} />
      </div>

      {trainer.lateSessions > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlarmClock className="h-4 w-4 shrink-0" aria-hidden />
          {trainer.lateSessions} of {trainer.sessions} check-ins were flagged late.
        </p>
      )}

      {/* Bio */}
      {trainer.description && (
        <section aria-labelledby="trainer-bio-heading" className="mt-10">
          <h2 id="trainer-bio-heading" className="mb-4 font-display text-xl text-ink-strong">
            About
          </h2>
          <div
            className="portal-glow prose-sm rounded-2xl border border-edge bg-surface p-6 text-sm leading-relaxed text-ink"
            // The training system stores this bio as HTML authored by staff.
            dangerouslySetInnerHTML={{ __html: trainer.description }}
          />
        </section>
      )}

      {/* Courses */}
      <section aria-labelledby="trainer-courses-heading" className="mt-10">
        <h2 id="trainer-courses-heading" className="mb-4 font-display text-xl text-ink-strong">
          Courses taught
        </h2>
        {courses.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No courses assigned to this trainer yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/portal/admin/courses/${c.id}`}
                className="portal-glow group rounded-2xl border border-edge bg-surface p-5 transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg text-ink-strong group-hover:text-brand-700">{c.name}</h3>
                  <Pill tone={statusTone[c.status]}>{c.status}</Pill>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {c.enrolledCount} enrolled
                  {c.durationMonths > 0 ? ` · ${c.durationMonths} months` : ""}
                  {c.startedAt ? ` · started ${c.startedAt}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Students */}
      <section aria-labelledby="trainer-students-heading" className="mt-10">
        <h2 id="trainer-students-heading" className="mb-4 font-display text-xl text-ink-strong">
          Students{" "}
          <span className="font-sans text-sm text-ink-muted">
            ({studentPage.total.toLocaleString()} total)
          </span>
        </h2>
        {studentPage.students.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No students assigned to this trainer yet.
          </div>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Student</Th>
                <Th>Course</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {studentPage.students.map((s) => (
                <tr key={s.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <Link href={`/portal/admin/students/${s.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar name={s.name} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{s.name}</p>
                        <p className="truncate text-xs text-ink-muted">{s.email}</p>
                      </div>
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">{courseName[s.courseId] ?? "—"}</Td>
                  <Td>
                    <Pill tone={s.enrollmentStatus === "active" ? "green" : "red"}>{s.enrollmentStatus}</Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </>
  );
}
