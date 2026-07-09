"use client";

/**
 * Client auth — real Supabase Auth (cookie sessions).
 *
 * Signup goes through /api/auth/signup (server creates a pre-confirmed
 * user; admin signups need the invite code), then signs in. Sessions are
 * verified server-side in pages/API routes via lib/auth-server.ts.
 */
import { useSyncExternalStore } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import type { Session, UserRole } from "@/types/management";
import { supabaseBrowser } from "@/lib/supabase-browser";

function toSession(supabase: SupabaseSession | null): Session | null {
  const user = supabase?.user;
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as { name?: string; role?: string };
  const role = meta.role;
  if (role !== "admin" && role !== "donor" && role !== "trainer") return null;
  return {
    userId: user.id,
    name: meta.name ?? user.email ?? "User",
    email: user.email ?? "",
    role,
  };
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  role: Extract<UserRole, "admin" | "donor">;
  adminCode?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await res.json();
    if (!res.ok) return { ok: false, error: payload.error ?? "Signup failed." };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
  // Account created — sign straight in.
  const { error } = await supabaseBrowser().auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function login(
  email: string,
  password: string,
  role: UserRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabaseBrowser();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      ok: false,
      error: /invalid login credentials/i.test(error.message)
        ? "Invalid email or password."
        : error.message,
    };
  }
  const session = toSession(data.session);
  if (!session) {
    await client.auth.signOut();
    return { ok: false, error: "This account has no portal role assigned — contact an admin." };
  }
  if (session.role !== role) {
    await client.auth.signOut();
    return {
      ok: false,
      error: `This account is registered as ${session.role} — switch to the ${session.role} tab to log in.`,
    };
  }
  return { ok: true };
}

export async function logout() {
  await supabaseBrowser().auth.signOut();
}

/* ── reactive session (undefined = loading, null = signed out) ── */

let cached: Session | null | undefined = undefined;
const listeners = new Set<() => void>();
let initialized = false;

function emit() {
  for (const listener of listeners) listener();
}

function init() {
  if (initialized) return;
  initialized = true;
  const client = supabaseBrowser();
  client.auth.getSession().then(({ data }) => {
    cached = toSession(data.session);
    emit();
  });
  client.auth.onAuthStateChange((_event, session) => {
    cached = toSession(session);
    emit();
  });
}

function subscribe(callback: () => void) {
  init();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useSession(): Session | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => cached,
    (): Session | null | undefined => undefined,
  );
}
