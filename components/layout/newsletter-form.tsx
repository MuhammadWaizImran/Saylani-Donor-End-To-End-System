"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setSubscribed(true);
  };

  if (subscribed) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-3 text-sm font-semibold text-accent-400">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        You&apos;re subscribed. Welcome aboard!
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full min-w-0 rounded-xl border border-brand-800 bg-brand-900 px-4 py-2.5 text-sm text-white placeholder:text-brand-400 focus:border-accent-500 focus:outline-none"
          aria-invalid={!!error}
          aria-describedby={error ? "newsletter-error" : undefined}
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-accent-950 transition-colors hover:bg-accent-400"
        >
          Join
        </button>
      </div>
      {error && (
        <p id="newsletter-error" role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
