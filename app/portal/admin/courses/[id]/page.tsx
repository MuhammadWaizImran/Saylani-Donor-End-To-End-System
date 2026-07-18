import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  GraduationCap,
  Info,
  Layers,
  School,
} from "lucide-react";
import {
  getCourseDetail,
  resolveNames,
  searchActiveClasses,
  searchStudents,
} from "@/lib/management-api";
import { Avatar, Pill, StatCard, TableShell, Td, Th } from "@/components/portal/ui";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourseDetail(id);
  return { title: course ? course.name : "Course" };
}

const statusTone = { running: "green", completed: "dark", upcoming: "gray" } as const;

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourseDetail(id);
  if (!course) notFound();

  const [studentPage, classPage] = await Promise.all([
    searchStudents({ courseId: id, pageSize: 50 }),
    searchActiveClasses({ pageSize: 50 }),
  ]);
  const courseClasses = classPage.classes.filter((c) => c.courseId === id);

  const [campusName, trainerName] = await Promise.all([
    resolveNames("campuses", [
      ...course.campusIds,
      course.campusId,
      ...studentPage.students.map((s) => s.campusId),
    ]),
    resolveNames("trainers", [course.trainerId, ...courseClasses.map((c) => c.trainerId)]),
  ]);

  return (
    <>
      <Link
        href="/portal/admin/courses"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All courses
      </Link>

      {/* Hero */}
      <div className="portal-glow overflow-hidden rounded-2xl border border-edge bg-surface">
        <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-brand-solid via-brand-500 to-accent-500 sm:h-64">
          {course.coverImage ? (
            <Image src={course.coverImage} alt={course.name} fill className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <School className="h-14 w-14 text-white/40" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl text-ink-strong sm:text-4xl">{course.name}</h1>
              <Pill tone={statusTone[course.status]}>{course.status}</Pill>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {course.category !== "—" ? `${course.category} · ` : ""}
              Batch {course.batchNumber || "—"}
              {course.startedAt ? ` · started ${course.startedAt}` : ""}
            </p>
            {course.gender.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {course.gender.map((g) => (
                  <Pill key={g} tone="gray">
                    {g}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={GraduationCap} label="Enrolled" value={course.enrolledCount.toLocaleString()} />
        <StatCard icon={CalendarClock} label="Classes" value={courseClasses.length.toLocaleString()} />
        <StatCard icon={Layers} label="Duration" value={course.durationText || "—"} />
        <StatCard icon={Banknote} label="Fee" value={course.fees > 0 ? formatCurrency(course.fees) : "—"} />
      </div>

      {/* Campuses + trainer */}
      <section aria-labelledby="course-where-heading" className="mt-10">
        <h2 id="course-where-heading" className="mb-4 font-display text-xl text-ink-strong">
          Where it runs
        </h2>
        <div className="portal-glow grid grid-cols-1 gap-5 rounded-2xl border border-edge bg-surface p-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Campuses</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(course.campusIds.length ? course.campusIds : [course.campusId])
                .filter(Boolean)
                .map((cid) => (
                  <Link key={cid} href={`/portal/admin/campuses/${cid}`}>
                    <Pill tone="dark">{campusName[cid] ?? "—"}</Pill>
                  </Link>
                ))}
              {course.campusIds.length === 0 && !course.campusId && (
                <span className="text-sm text-ink-muted">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Trainer</p>
            {course.trainerId ? (
              <Link
                href={`/portal/admin/trainers/${course.trainerId}`}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:underline"
              >
                <Avatar name={trainerName[course.trainerId] ?? "—"} />
                {trainerName[course.trainerId] ?? "—"}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Not assigned</p>
            )}
          </div>
        </div>
      </section>

      {/* Description */}
      {course.description && (
        <section aria-labelledby="course-about-heading" className="mt-10">
          <h2 id="course-about-heading" className="mb-4 font-display text-xl text-ink-strong">
            About this course
          </h2>
          <div
            className="portal-glow rounded-2xl border border-edge bg-surface p-6 text-sm leading-relaxed text-ink"
            // Stored as HTML by the training system's course editor.
            dangerouslySetInnerHTML={{ __html: course.description }}
          />
        </section>
      )}

      {/* Outline */}
      {course.outline.length > 0 && (
        <section aria-labelledby="course-outline-heading" className="mt-10">
          <h2 id="course-outline-heading" className="mb-4 font-display text-xl text-ink-strong">
            Course outline
          </h2>
          <ul className="portal-glow space-y-2.5 rounded-2xl border border-edge bg-surface p-6">
            {course.outline.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-50 text-[10px] font-bold text-accent-700">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Admission instructions */}
      {course.instructions.length > 0 && (
        <section aria-labelledby="course-instructions-heading" className="mt-10">
          <h2 id="course-instructions-heading" className="mb-4 font-display text-xl text-ink-strong">
            Admission instructions
          </h2>
          <ul className="portal-glow space-y-2.5 rounded-2xl border border-edge bg-surface p-6">
            {course.instructions.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Classes */}
      <section aria-labelledby="course-classes-heading" className="mt-10">
        <h2 id="course-classes-heading" className="mb-4 font-display text-xl text-ink-strong">
          Class slots
        </h2>
        {courseClasses.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No class slots scheduled for this course right now.
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
              {courseClasses.map((c) => (
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

      {/* Students */}
      <section aria-labelledby="course-students-heading" className="mt-10">
        <h2 id="course-students-heading" className="mb-4 font-display text-xl text-ink-strong">
          Enrolled students{" "}
          <span className="font-sans text-sm text-ink-muted">({studentPage.total.toLocaleString()} total)</span>
        </h2>
        {studentPage.students.length === 0 ? (
          <div className="portal-glow rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
            No students enrolled in this course yet.
          </div>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-edge bg-surface-muted">
                <Th>Student</Th>
                <Th>Campus</Th>
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
                  <Td className="text-ink-muted">{campusName[s.campusId] ?? "—"}</Td>
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
