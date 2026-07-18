import type { UserRole } from "@/types/management";

/** Who the assistant is talking to. Always derived from the verified
 *  session on the server — never from the client. */
export interface AgentContext {
  /** Verified session user id — stamped on any report this user generates so
   *  only they can download it (see lib/ai/report.ts + /api/reports/[id]). */
  userId: string;
  role: Extract<UserRole, "admin" | "trainer">;
  userName: string;
  userEmail: string;
}

/**
 * What the assistant says when Groq can't be reached (no key configured, or
 * every key rate-limited).
 *
 * This deliberately answers nothing. It replaces an earlier offline "brain"
 * that composed replies out of the demo dataset — that made the assistant
 * quote invented campuses, student counts, and placement rates that exist
 * nowhere in the database, and it did so in the same confident voice as a
 * real answer. Silence that admits it is silence beats a confident fiction.
 */
export const AI_UNAVAILABLE_MESSAGE = [
  "I can't reach the AI service right now, so I'd rather not answer than guess — this assistant only ever reports real database figures, and I can't fetch them at the moment.",
  "",
  "The dashboard itself is unaffected: **Campuses**, **Students**, **Trainers**, **Attendance** and **Fee Payments** are all still reading live from the database.",
  "",
  "Please try me again in a minute.",
].join("\n");
