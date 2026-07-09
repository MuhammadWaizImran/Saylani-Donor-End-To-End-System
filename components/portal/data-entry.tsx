"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  HandCoins,
  Loader2,
  Megaphone,
  School,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── form schema definitions (drive both UI and payload) ───── */

type Option = { id: string; name: string };

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "textarea" | "select" | "checkbox";
  /** For selects: static options, or a lookup key resolved from the API. */
  options?: string[] | "campuses" | "trainers" | "courses" | "campaigns";
  placeholder?: string;
  required?: boolean;
  default?: string | boolean;
}

interface EntityDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  blurb: string;
  fields: FieldDef[];
}

const entities: EntityDef[] = [
  {
    id: "student",
    label: "Student",
    icon: GraduationCap,
    blurb: "Enroll a new student — campus, course, and trainer assignment.",
    fields: [
      { key: "name", label: "Full name", type: "text", placeholder: "e.g. Ali Hassan", required: true },
      { key: "email", label: "Email", type: "email", placeholder: "student@example.com", required: true },
      { key: "phone", label: "Phone", type: "text", placeholder: "+92 3xx xxxxxxx", required: true },
      { key: "campus_id", label: "Campus", type: "select", options: "campuses", required: true },
      { key: "course_id", label: "Course", type: "select", options: "courses", required: true },
      { key: "trainer_id", label: "Trainer", type: "select", options: "trainers", required: true },
      { key: "enrollment_status", label: "Enrollment status", type: "select", options: ["active", "inactive"], default: "active", required: true },
    ],
  },
  {
    id: "campaign",
    label: "Campaign",
    icon: Megaphone,
    blurb: "Publish a new donation campaign on the public website.",
    fields: [
      { key: "title", label: "Title", type: "text", placeholder: "e.g. Ramzan Ration Drive 2027", required: true },
      { key: "tagline", label: "Tagline", type: "text", placeholder: "One line that moves hearts", required: true },
      { key: "description", label: "Description", type: "textarea", placeholder: "What is this campaign about?", required: true },
      { key: "category", label: "Category", type: "select", options: ["Education", "Healthcare", "Food Relief", "Clean Water", "Emergency", "Orphan Care"], required: true },
      { key: "location", label: "Location", type: "text", placeholder: "e.g. Karachi", required: true },
      { key: "goal_amount", label: "Goal amount (PKR)", type: "number", placeholder: "1000000", required: true },
      { key: "status", label: "Status", type: "select", options: ["active", "urgent"], default: "active", required: true },
      { key: "ends_at", label: "End date", type: "date", required: true },
      { key: "image_url", label: "Image path/URL", type: "text", placeholder: "/media/hands-giving.avif", default: "/media/hands-giving.avif" },
    ],
  },
  {
    id: "campus",
    label: "Campus",
    icon: Building2,
    blurb: "Register a new Saylani campus.",
    fields: [
      { key: "name", label: "Campus name", type: "text", placeholder: "e.g. Multan Campus", required: true },
      { key: "city", label: "City", type: "text", placeholder: "e.g. Multan", required: true },
      { key: "address", label: "Address", type: "text", placeholder: "Street address", required: true },
      { key: "established", label: "Established (year)", type: "text", placeholder: "2026", default: "2026", required: true },
    ],
  },
  {
    id: "trainer",
    label: "Trainer",
    icon: Users,
    blurb: "Add a trainer with campus assignment and salary.",
    fields: [
      { key: "name", label: "Full name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "campus_id", label: "Campus", type: "select", options: "campuses", required: true },
      { key: "specialization", label: "Specialization", type: "text", placeholder: "e.g. MERN Stack Development", required: true },
      { key: "salary", label: "Monthly salary (PKR)", type: "number", placeholder: "120000", required: true },
      { key: "joined_at", label: "Joining date", type: "date", required: true },
    ],
  },
  {
    id: "course",
    label: "Course",
    icon: School,
    blurb: "Create a course and assign its campus and trainer.",
    fields: [
      { key: "name", label: "Course name", type: "text", placeholder: "e.g. Cloud Computing Bootcamp", required: true },
      { key: "campus_id", label: "Campus", type: "select", options: "campuses", required: true },
      { key: "trainer_id", label: "Trainer", type: "select", options: "trainers", required: true },
      { key: "status", label: "Status", type: "select", options: ["upcoming", "running", "completed"], default: "upcoming", required: true },
      { key: "duration_months", label: "Duration (months)", type: "number", placeholder: "6", required: true },
      { key: "started_at", label: "Start date", type: "date", required: true },
    ],
  },
  {
    id: "active_class",
    label: "Class",
    icon: CalendarClock,
    blurb: "Schedule a live class section.",
    fields: [
      { key: "name", label: "Class name", type: "text", placeholder: "e.g. Batch 13 — Section A", required: true },
      { key: "campus_id", label: "Campus", type: "select", options: "campuses", required: true },
      { key: "trainer_id", label: "Trainer", type: "select", options: "trainers", required: true },
      { key: "course_id", label: "Course", type: "select", options: "courses", required: true },
      { key: "student_count", label: "Students attending", type: "number", placeholder: "40", required: true },
      { key: "timing", label: "Timing", type: "text", placeholder: "Mon–Fri · 9:00–11:00 AM", required: true },
    ],
  },
  {
    id: "donation",
    label: "Donation",
    icon: HandCoins,
    blurb: "Record an offline donation (bank/cash) — campaign totals update automatically.",
    fields: [
      { key: "campaign_id", label: "Campaign", type: "select", options: "campaigns", required: true },
      { key: "donor_name", label: "Donor name", type: "text", required: true },
      { key: "amount", label: "Amount (PKR)", type: "number", placeholder: "5000", required: true },
      { key: "method", label: "Method", type: "select", options: ["Bank Transfer", "Cash", "JazzCash", "Easypaisa", "Card"], default: "Bank Transfer", required: true },
      { key: "is_anonymous", label: "Anonymous donor (hide name publicly)", type: "checkbox", default: false },
      { key: "message", label: "Message (optional)", type: "textarea", placeholder: "Donor's message…" },
    ],
  },
];

interface LookupData {
  campuses: Option[];
  trainers: Option[];
  courses: Option[];
  campaigns: Option[];
}

const inputClass =
  "w-full rounded-xl border-2 border-edge bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

export function DataEntry() {
  const [active, setActive] = useState(entities[0]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [lookups, setLookups] = useState<LookupData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadLookups = () => {
    fetch("/api/admin/records")
      .then((res) => res.json())
      .then((data: LookupData) => setLookups(data))
      .catch(() => setLookups({ campuses: [], trainers: [], courses: [], campaigns: [] }));
  };
  useEffect(loadLookups, []);

  const selectEntity = (entity: EntityDef) => {
    setActive(entity);
    setValues({});
    setResult(null);
  };

  const optionsFor = (field: FieldDef): Option[] => {
    if (Array.isArray(field.options)) return field.options.map((o) => ({ id: o, name: o }));
    if (field.options && lookups) return lookups[field.options];
    return [];
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    // Fill defaults + basic required check
    const data: Record<string, string | boolean> = {};
    for (const field of active.fields) {
      const raw = values[field.key] ?? field.default ?? (field.type === "checkbox" ? false : "");
      if (field.required && (raw === "" || raw === undefined)) {
        setResult({ ok: false, message: `"${field.label}" is required.` });
        return;
      }
      data[field.key] = raw;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: active.id, data }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: payload.error ?? "Something went wrong." });
      } else {
        setResult({ ok: true, message: payload.message ?? "Saved." });
        setValues({});
        loadLookups(); // fresh dropdowns (e.g. new campus available for students)
      }
    } catch {
      setResult({ ok: false, message: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Entity picker */}
      <div className="flex flex-row flex-wrap gap-2 lg:flex-col" role="tablist" aria-label="Data type">
        {entities.map((entity) => {
          const Icon = entity.icon;
          const isActive = entity.id === active.id;
          return (
            <button
              key={entity.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectEntity(entity)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                isActive
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-edge bg-white text-[#6F6F6F] hover:border-brand-300 hover:text-black",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-brand-700" : "text-ink-muted")} aria-hidden />
              Add {entity.label}
            </button>
          );
        })}
      </div>

      {/* Active form */}
      <AnimatePresence mode="wait">
        <motion.form
          key={active.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          onSubmit={onSubmit}
          noValidate
          className="portal-glow rounded-2xl border border-edge bg-white p-6 sm:p-8"
        >
          <h2 className="font-display text-2xl text-black">New {active.label.toLowerCase()}</h2>
          <p className="mt-1 text-sm text-ink-muted">{active.blurb}</p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {active.fields.map((field) => {
              const id = `${active.id}-${field.key}`;
              const value = values[field.key] ?? field.default ?? "";
              const wide = field.type === "textarea";
              if (field.type === "checkbox") {
                return (
                  <label key={field.key} className="flex items-center gap-3 sm:col-span-2">
                    <input
                      id={id}
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.checked }))}
                      className="h-4 w-4 accent-accent-600"
                    />
                    <span className="text-sm font-semibold text-ink">{field.label}</span>
                  </label>
                );
              }
              return (
                <div key={field.key} className={wide ? "sm:col-span-2" : undefined}>
                  <label htmlFor={id} className="block text-sm font-bold text-ink">
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      id={id}
                      value={String(value)}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      className={cn(inputClass, "mt-2")}
                    >
                      <option value="">Select…</option>
                      {optionsFor(field).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={id}
                      rows={3}
                      value={String(value)}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className={cn(inputClass, "mt-2 resize-y")}
                    />
                  ) : (
                    <input
                      id={id}
                      type={field.type}
                      value={String(value)}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className={cn(inputClass, "mt-2")}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {result && (
            <p
              role="alert"
              className={cn(
                "mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
                result.ok ? "bg-accent-50 text-accent-800" : "bg-red-50 text-red-700",
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {result.message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-700 px-8 py-3 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.02] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Briefcase className="h-4 w-4 text-accent-400" aria-hidden />
            )}
            {submitting ? "Saving…" : `Save ${active.label.toLowerCase()}`}
          </button>
          <p className="mt-3 text-xs text-ink-muted">
            Saved directly to the live database — dashboards, website, and the AI assistant see it immediately.
          </p>
        </motion.form>
      </AnimatePresence>
    </div>
  );
}
