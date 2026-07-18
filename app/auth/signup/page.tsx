"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HandCoins, UserPlus } from "lucide-react";
import { signUp } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError("Please enter your full name (min 3 characters).");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await signUp({ name, email, password, role: "donor" });
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
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
          Saylani portal
        </p>
        <h1 className="text-center font-display text-4xl tracking-tight text-ink-strong sm:text-5xl">
          Create your <em className="text-ink-muted">donor account</em>
        </h1>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-ink-muted">
          <HandCoins className="h-4 w-4 text-brand-600" aria-hidden />
          Track the impact of your giving across every campus.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <div>
            <label htmlFor="signup-name" className="block text-sm font-bold text-ink">
              Full name
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Raza"
              className="mt-2 w-full rounded-xl border-2 border-edge bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="block text-sm font-bold text-ink">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-xl border-2 border-edge bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="signup-password" className="block text-sm font-bold text-ink">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="mt-2 w-full rounded-xl border-2 border-edge bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-bold text-ink">
                Confirm
              </label>
              <input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="mt-2 w-full rounded-xl border-2 border-edge bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
              />
            </div>
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
            <UserPlus className="h-4 w-4 text-accent-400" aria-hidden />
            {busy ? "Creating account…" : "Create donor account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already registered?{" "}
          <Link href="/auth/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
