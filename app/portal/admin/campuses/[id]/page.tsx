import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock, GraduationCap, MapPin, School, Users } from "lucide-react";
import {
  getCampusById,
  resolveNames,
  searchActiveClasses,
  searchCourses,
  searchTrainers,
} from "@/lib/management-api";
import { Avatar, Pill, StatCard, TableShell, Td, Th } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campus = await getCampusById(id);
  return { title: campus ? campus.name : "Campus" };
}

const statusTone = {
  running: "green",
  completed: "dark",
  upcoming: "gray",
} as const;

export default async function CampusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campus = await getCampusById(id);
  if (!campus) notFound();

  const [trainerPage, coursePage, classPage] = await Promise.all([
    searchTrainers({ campusId: id, pageSize: 50 }),
    searchCourses({ campusId: id, pageSize: 50 }),
    searchActiveClasses({ campusId: id, pageSize: 50 }),
  ]);

  const trainerName = await resolveNames(
    "trainers",
    classPage.classes.map((c) => c.trainerId),
  );

  return (
    <>
      <Link
        href="/portal/admin/campuses"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All campuses
      </Link>

      {/* Hero */}
      <div className="portal-glow overflow-hidden rounded-2xl border border-edge bg-surface">
        <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-brand-solid via-brand-500 to-accent-500 sm:h-72">
          {campus.image ? (
            <Image src={campus.image} alt={campus.name} fill className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-16 w-16 text-white/40" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h1 className="font-display text-3xl text-ink-strong sm:text-4xl">{campus.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {campus.address ? `${campus.address}, ` : ""}
              {campus.city}
            </p>
          </div>
          <span className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-muted">
            Since {campus.established || "—"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={GraduationCap} label="Students" value={campus.studentCount.toLocaleString()} />
        <StatCard icon={Users} label="Trainers" value={campus.trainerCount.toLocaleString()} />
        <StatCard icon={School} label="Courses" value={campus.courseCount.toLocaleString()} />
        <StatCard icon={CalendarClock} label="Active classes" value={classPage.total.toLocaleString()} />
      </div>

      {/* Trainers */}
      <section aria-labelledby="campus-trainers-heading" className="mt-10">
        <h2 id="campus-trainers-heading" className="mb-4 font-display text-xl text-ink-strong">
          Trainers at this campus
        </h2>
        {trainerPage.trainers.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No trainers assigned to this campus yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trainerPage.trainers.map((t) => (
              <Link
                key={t.id}
                href={`/portal/admin/trainers/${t.id}`}
                className="portal-glow group flex items-center gap-3 rounded-2xl border border-edge bg-surface p-4 transition-all hover:-translate-y-0.5"
              >
                <Avatar name={t.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-700">{t.name}</p>
                  <p className="truncate text-xs text-ink-muted">{t.specialization}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Courses */}
      <section aria-labelledby="campus-courses-heading" className="mt-10">
        <h2 id="campus-courses-heading" className="mb-4 font-display text-xl text-ink-strong">
          Courses offered
        </h2>
        {coursePage.courses.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No courses recorded for this campus yet.
          </div>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Course</Th>
                <Th>Status</Th>
                <Th>Enrolled</Th>
                <Th>Duration</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {coursePage.courses.map((c) => (
                <tr key={c.id} className="group hover:bg-surface-muted/60">
                  <Td>
                    <Link
                      href={`/portal/admin/courses/${c.id}`}
                      className="font-semibold text-ink group-hover:text-brand-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </Td>
                  <Td>
                    <Pill tone={statusTone[c.status]}>{c.status}</Pill>
                  </Td>
                  <Td>{c.enrolledCount}</Td>
                  <Td className="text-ink-muted">{c.durationMonths > 0 ? `${c.durationMonths} months` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>

      {/* Active classes */}
      <section aria-labelledby="campus-classes-heading" className="mt-10">
        <h2 id="campus-classes-heading" className="mb-4 font-display text-xl text-ink-strong">
          Active classes
        </h2>
        {classPage.classes.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No active classes at this campus right now.
          </div>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Class</Th>
                <Th>Trainer</Th>
                <Th>Students</Th>
                <Th>Timing</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {classPage.classes.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted/60">
                  <Td className="font-semibold text-ink">{c.name}</Td>
                  <Td className="text-ink-muted">{trainerName[c.trainerId] ?? "—"}</Td>
                  <Td>{c.studentCount}</Td>
                  <Td className="text-ink-muted">{c.timing || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </>
  );
}
