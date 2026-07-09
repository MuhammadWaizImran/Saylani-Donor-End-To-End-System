"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Fields {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const initial: Fields = { name: "", email: "", subject: "", message: "" };

export function ContactForm() {
  const [fields, setFields] = useState<Fields>(initial);
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [sent, setSent] = useState(false);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Fields> = {};
    if (fields.name.trim().length < 3) next.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) next.email = "Please enter a valid email.";
    if (fields.subject.trim().length < 3) next.subject = "Please add a subject.";
    if (fields.message.trim().length < 10) next.message = "Please write at least a short message.";
    setErrors(next);
    if (Object.keys(next).length === 0) setSent(true);
  };

  const inputClass = (invalid?: string) =>
    cn(
      "w-full rounded-xl border-2 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none",
      invalid ? "border-red-400 focus:border-red-500" : "border-edge focus:border-brand-500",
    );

  if (sent) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-edge bg-surface p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-accent-500" aria-hidden />
        <h3 className="mt-4 font-display text-xl text-ink">Message sent!</h3>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          Thanks, {fields.name.split(" ")[0]}. Our support team typically
          replies within one working day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-2xl border border-edge bg-surface p-6 shadow-sm sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-bold text-ink">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            value={fields.name}
            onChange={set("name")}
            placeholder="Your full name"
            className={cn(inputClass(errors.name), "mt-2")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name && (
            <p id="contact-name-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-bold text-ink">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={set("email")}
            placeholder="you@example.com"
            className={cn(inputClass(errors.email), "mt-2")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email && (
            <p id="contact-email-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="block text-sm font-bold text-ink">
          Subject
        </label>
        <input
          id="contact-subject"
          type="text"
          value={fields.subject}
          onChange={set("subject")}
          placeholder="How can we help?"
          className={cn(inputClass(errors.subject), "mt-2")}
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
        />
        {errors.subject && (
          <p id="contact-subject-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {errors.subject}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-bold text-ink">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={5}
          value={fields.message}
          onChange={set("message")}
          placeholder="Tell us more…"
          className={cn(inputClass(errors.message), "mt-2 resize-y")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {errors.message && (
          <p id="contact-message-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {errors.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700"
      >
        <Send className="h-4 w-4" aria-hidden />
        Send message
      </button>
    </form>
  );
}
