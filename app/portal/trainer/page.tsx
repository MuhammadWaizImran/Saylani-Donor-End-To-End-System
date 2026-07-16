"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  GraduationCap,
  Layers,
} from "lucide-react";
import type { Course, Student, Trainer } from "@/types/management";
import { useSession } from "@/lib/auth";
import {
  Avatar,
  Pill,
  StatCard,
  TableShell,
  Td,
  Th,
} from "@/components/portal/ui";
import { formatCompact } from "@/lib/utils";

interface DashboardData {
  trainer: Trainer;
  campusName: string;
  courses: Course[];
  students: Array<Student & { courseName: string }>;
}

export default function TrainerDashboardPage() {
  const session = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/portal/trainer")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload: DashboardData) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (failed) {
    return (
      <p className="py-20 text-center text-sm text-ink-muted">
        Could not load your dashboard — please refresh the page.
      </p>
    );
  }
  if (!data) {
    return (
      <p className="animate-pulse py-20 text-center text-sm text-ink-muted">
        Loading your dashboard…
      </p>
    );
  }

  const { trainer, campusName, courses, students } = data;
  const activeStudents = students.filter((s) => s.enrollmentStatus === "active");

  const cards = [
    { icon: Building2, label: "Assigned campus", value: campusName },
    { icon: GraduationCap, label: "Your students", value: String(trainer.studentCount) },
    { icon: Layers, label: "Class slots", value: String(trainer.batchesCount) },
    { icon: Banknote, label: "Hourly rate", value: formatCompact(trainer.salary) },
  ];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Avatar name={trainer.name} className="h-14 w-14 text-base" />
        <div>
          <h1 className="font-display text-3xl tracking-tight text-black sm:text-4xl">
            {trainer.name}
          </h1>
          <p className="mt-1 text-sm text-[#6F6F6F]">
            {trainer.specialization} · {campusName} · Joined {trainer.joinedAt}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <section aria-labelledby="trainer-courses-heading" className="mt-10">
        <h2 id="trainer-courses-heading" className="mb-4 font-display text-xl text-black">
          Courses you&apos;re teaching
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {courses.map((c) => (
            <article key={c.id} className="portal-glow rounded-2xl border border-edge bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg text-black">{c.name}</h3>
                <Pill tone={c.status === "running" ? "green" : c.status === "completed" ? "dark" : "gray"}>
                  {c.status}
                </Pill>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {c.enrolledCount} enrolled
                {c.durationMonths > 0 ? ` · ${c.durationMonths} months` : ""} · started {c.startedAt}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="trainer-students-heading" className="mt-10">
        <h2 id="trainer-students-heading" className="mb-4 font-display text-xl text-black">
          Your students <span className="font-sans text-sm text-ink-muted">({activeStudents.length} active)</span>
        </h2>
        <TableShell minWidth={640}>
          <thead>
            <tr className="border-b border-edge bg-surface-muted">
              <Th>Student</Th>
              <Th>Course</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-surface-muted/60">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} />
                    <span className="font-semibold text-ink">{s.name}</span>
                  </div>
                </Td>
                <Td className="text-ink-muted">{s.courseName}</Td>
                <Td>
                  <Pill tone={s.enrollmentStatus === "active" ? "green" : "red"}>
                    {s.enrollmentStatus}
                  </Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </section>
    </>
  );
}
