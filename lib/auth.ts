"use client";

/**
 * Client auth — custom JWT-cookie sessions backed by MongoDB (see
 * lib/auth-server.ts / app/api/auth/*). Signup goes through /api/auth/signup
 * (donor accounts only — admin/trainer accounts are the company's real
 * MongoDB records and aren't self-served), then logs in. Sessions are
 * verified server-side in pages/API routes via lib/auth-server.ts; the
 * client only ever sees the session via /api/auth/session since the cookie
 * itself is httpOnly.
 */
import { useSyncExternalStore } from "react";
import type { Session, UserRole } from "@/types/management";

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  role: "donor";
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
  return login(input.email, input.password, "donor");
}

export async function login(
  email: string,
  password: string,
  role: UserRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    const payload = await res.json();
    if (!res.ok) return { ok: false, error: payload.error ?? "Invalid email or password." };
    cached = payload.session;
    emit();
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  cached = null;
  emit();
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
  fetch("/api/auth/session")
    .then((res) => res.json())
    .then((payload) => {
      cached = payload.session;
      emit();
    })
    .catch(() => {
      cached = null;
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
