"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, HandCoins, LogIn, ShieldCheck } from "lucide-react";
import type { UserRole } from "@/types/management";
import { login } from "@/lib/auth";
import { SaylaniLogo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const roles: Array<{ id: UserRole; label: string; icon: typeof ShieldCheck; hint: string }> = [
  { id: "donor", label: "Donor", icon: HandCoins, hint: "Sign up for a donor account below" },
  { id: "admin", label: "Admin", icon: ShieldCheck, hint: "Use your company admin account" },
  { id: "trainer", label: "Trainer", icon: GraduationCap, hint: "Use your company trainer account" },
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("donor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeRole = roles.find((r) => r.id === role)!;

  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const result = await login(email, password, role);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/portal");
  };

  return (
    <div className="mx-auto flex min-h-[80svh] max-w-md flex-col justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* The artwork already carries the Saylani wordmark, so it stands in
            for the "Saylani portal" eyebrow that used to sit here. */}
        <div className="mb-6 flex justify-center">
          <SaylaniLogo width={210} />
        </div>
        <h1 className="text-center font-display text-4xl tracking-tight text-ink-strong sm:text-5xl">
          Welcome <em className="text-ink-muted">back</em>
        </h1>
        <p className="mt-3 text-center text-sm text-ink-muted">
          Log in to your dashboard to see the impact in motion.
        </p>

        {/* Role tabs */}
        <div
          role="tablist"
          aria-label="Account type"
          className="mt-8 grid grid-cols-3 gap-1 rounded-full border border-edge bg-surface-muted p-1"
        >
          {roles.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={role === id}
              onClick={() => {
                setRole(id);
                setError(null);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors",
                role === id ? "bg-brand-solid text-white shadow" : "text-ink-muted hover:text-ink-strong",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-bold text-ink">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-xl border-2 border-edge bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-bold text-ink">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-xl border-2 border-edge bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-solid px-6 py-3.5 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.02] disabled:opacity-60"
          >
            <LogIn className="h-4 w-4 text-accent-400" aria-hidden />
            {busy ? "Logging in…" : `Log in as ${activeRole.label}`}
          </button>
        </form>

        <p className="mt-4 rounded-xl bg-accent-50 px-4 py-3 text-center text-xs text-accent-800">
          Demo account — <span className="font-semibold">{activeRole.hint}</span>
        </p>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Want to support our campaigns?{" "}
          <Link href="/auth/signup" className="font-semibold text-brand-700 hover:underline">
            Sign up as a donor
          </Link>
          . Admin and trainer accounts are provided by Saylani.
        </p>
      </motion.div>
    </div>
  );
}
