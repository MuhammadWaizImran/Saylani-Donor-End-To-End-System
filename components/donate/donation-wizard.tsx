"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Download,
  HeartHandshake,
  Landmark,
  PartyPopper,
  Smartphone,
  Wallet,
} from "lucide-react";
import type { Campaign, PaymentMethodId } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";

const presetAmounts = [500, 1000, 2500, 5000, 10000, 25000];

const paymentMethods: Array<{
  id: PaymentMethodId;
  name: string;
  description: string;
  icon: typeof Smartphone;
  accent: string;
}> = [
  {
    id: "jazzcash",
    name: "JazzCash",
    description: "Pay from your JazzCash mobile wallet",
    icon: Smartphone,
    accent: "text-brand-700 bg-brand-50",
  },
  {
    id: "easypaisa",
    name: "Easypaisa",
    description: "Pay from your Easypaisa mobile wallet",
    icon: Wallet,
    accent: "text-accent-700 bg-accent-50 dark:bg-accent-950 dark:text-accent-400",
  },
  {
    id: "bank",
    name: "Bank Transfer",
    description: "Direct transfer / IBFT to our bank account",
    icon: Landmark,
    accent: "text-brand-700 bg-brand-50 dark:bg-brand-950 dark:text-brand-300",
  },
  {
    id: "card",
    name: "Debit / Credit Card",
    description: "Visa, Mastercard — international donors welcome",
    icon: CreditCard,
    accent: "text-accent-800 bg-accent-100",
  },
];

const stepLabels = ["Amount", "Your details", "Payment", "Done"];

interface FormState {
  campaignId: string;
  amount: number | null;
  customAmount: string;
  donorName: string;
  email: string;
  phone: string;
  isAnonymous: boolean;
  paymentMethod: PaymentMethodId | null;
}

export function DonationWizard({
  campaigns,
  initialCampaignId,
  initialAmount,
}: {
  campaigns: Campaign[];
  initialCampaignId?: string;
  initialAmount?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({
    campaignId: initialCampaignId ?? campaigns[0]?.id ?? "",
    amount: initialAmount && initialAmount >= 100 ? initialAmount : 2500,
    customAmount: initialAmount && !presetAmounts.includes(initialAmount) && initialAmount >= 100 ? String(initialAmount) : "",
    donorName: "",
    email: "",
    phone: "",
    isAnonymous: false,
    paymentMethod: null,
  });

  const campaign = useMemo(
    () => campaigns.find((c) => c.id === form.campaignId) ?? campaigns[0],
    [campaigns, form.campaignId],
  );
  const amount = form.customAmount ? Number(form.customAmount) : form.amount ?? 0;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validateStep = (current: number) => {
    const next: Record<string, string> = {};
    if (current === 0) {
      if (!amount || Number.isNaN(amount) || amount < 100)
        next.amount = "Please choose or enter an amount of at least Rs. 100.";
    }
    if (current === 1) {
      if (!form.isAnonymous && form.donorName.trim().length < 3)
        next.donorName = "Please enter your full name (min 3 characters).";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        next.email = "Please enter a valid email — your receipt goes here.";
      if (!/^(\+?\d[\d\s-]{8,15})$/.test(form.phone.trim()))
        next.phone = "Please enter a valid phone number, e.g. +92 300 1234567.";
    }
    if (current === 2) {
      if (!form.paymentMethod) next.paymentMethod = "Please select a payment method.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, 3));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const inputClass = (invalid?: boolean) =>
    cn(
      "w-full rounded-xl border-2 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none",
      invalid ? "border-red-400 focus:border-red-500" : "border-edge focus:border-brand-500",
    );

  const fieldError = (key: string, id: string) =>
    errors[key] ? (
      <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Step indicator */}
      <ol className="mb-8 flex items-center gap-2" aria-label="Donation progress">
        {stepLabels.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-colors",
                  done && "bg-accent-500 text-accent-950",
                  active && "bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-950",
                  !done && !active && "bg-surface-muted text-ink-muted",
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-bold sm:block",
                  active ? "text-ink" : "text-ink-muted",
                )}
              >
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <span
                  aria-hidden
                  className={cn("h-0.5 flex-1 rounded", done ? "bg-accent-500" : "bg-edge")}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-edge bg-surface p-6 shadow-lg shadow-brand-950/5 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {step === 0 && (
              <section aria-labelledby="step-amount-heading">
                <h2 id="step-amount-heading" className="font-display text-2xl text-ink">
                  How much would you like to give?
                </h2>

                <label htmlFor="wizard-campaign" className="mt-6 block text-sm font-bold text-ink">
                  Donating to
                </label>
                <select
                  id="wizard-campaign"
                  value={form.campaignId}
                  onChange={(e) => set("campaignId", e.target.value)}
                  className="mt-2 w-full rounded-xl border-2 border-edge bg-surface px-4 py-3 text-sm font-medium text-ink focus:border-brand-500 focus:outline-none"
                >
                  {campaigns
                    .filter((c) => c.status !== "completed")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} — {c.category}
                      </option>
                    ))}
                </select>

                <fieldset className="mt-6">
                  <legend className="text-sm font-bold text-ink">Amount (PKR)</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {presetAmounts.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        aria-pressed={!form.customAmount && form.amount === preset}
                        onClick={() => {
                          set("amount", preset);
                          set("customAmount", "");
                          setErrors({});
                        }}
                        className={cn(
                          "rounded-xl border-2 px-2 py-3 text-sm font-bold transition-colors",
                          !form.customAmount && form.amount === preset
                            ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                            : "border-edge text-ink-muted hover:border-brand-300 hover:text-ink",
                        )}
                      >
                        {formatCurrency(preset)}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="wizard-custom-amount" className="sr-only">
                    Custom amount in rupees
                  </label>
                  <input
                    id="wizard-custom-amount"
                    type="number"
                    min={100}
                    inputMode="numeric"
                    value={form.customAmount}
                    onChange={(e) => {
                      set("customAmount", e.target.value);
                      set("amount", null);
                      setErrors({});
                    }}
                    placeholder="Or enter a custom amount"
                    className={cn(inputClass(!!errors.amount), "mt-3 font-semibold")}
                    aria-invalid={!!errors.amount}
                    aria-describedby={errors.amount ? "wizard-amount-error" : undefined}
                  />
                  {fieldError("amount", "wizard-amount-error")}
                </fieldset>
              </section>
            )}

            {step === 1 && (
              <section aria-labelledby="step-details-heading">
                <h2 id="step-details-heading" className="font-display text-2xl text-ink">
                  Tell us about yourself
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  We only use this to send your receipt and updates.
                </p>

                <div className="mt-6 space-y-5">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 border-edge px-4 py-3">
                    <span>
                      <span className="block text-sm font-bold text-ink">Donate anonymously</span>
                      <span className="block text-xs text-ink-muted">
                        Your name won&apos;t appear in public donor lists.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.isAnonymous}
                      onChange={(e) => set("isAnonymous", e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className="relative h-6 w-11 shrink-0 rounded-full bg-edge transition-colors peer-checked:bg-accent-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
                    />
                  </label>

                  {!form.isAnonymous && (
                    <div>
                      <label htmlFor="donor-name" className="block text-sm font-bold text-ink">
                        Full name
                      </label>
                      <input
                        id="donor-name"
                        type="text"
                        autoComplete="name"
                        value={form.donorName}
                        onChange={(e) => set("donorName", e.target.value)}
                        placeholder="e.g. Ahmed Raza"
                        className={cn(inputClass(!!errors.donorName), "mt-2")}
                        aria-invalid={!!errors.donorName}
                        aria-describedby={errors.donorName ? "donor-name-error" : undefined}
                      />
                      {fieldError("donorName", "donor-name-error")}
                    </div>
                  )}

                  <div>
                    <label htmlFor="donor-email" className="block text-sm font-bold text-ink">
                      Email address
                    </label>
                    <input
                      id="donor-email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@example.com"
                      className={cn(inputClass(!!errors.email), "mt-2")}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "donor-email-error" : undefined}
                    />
                    {fieldError("email", "donor-email-error")}
                  </div>

                  <div>
                    <label htmlFor="donor-phone" className="block text-sm font-bold text-ink">
                      Phone number
                    </label>
                    <input
                      id="donor-phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="+92 300 1234567"
                      className={cn(inputClass(!!errors.phone), "mt-2")}
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? "donor-phone-error" : undefined}
                    />
                    {fieldError("phone", "donor-phone-error")}
                  </div>
                </div>
              </section>
            )}

            {step === 2 && (
              <section aria-labelledby="step-payment-heading">
                <h2 id="step-payment-heading" className="font-display text-2xl text-ink">
                  Choose a payment method
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Demo mode — no real payment will be processed.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment methods">
                  {paymentMethods.map((method) => {
                    const selected = form.paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          set("paymentMethod", method.id);
                          setErrors({});
                        }}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
                          selected
                            ? "border-brand-600 bg-brand-50 dark:bg-brand-950"
                            : "border-edge hover:border-brand-300",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            method.accent,
                          )}
                        >
                          <method.icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-bold text-ink">
                            {method.name}
                            {selected && <Check className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden />}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                            {method.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {fieldError("paymentMethod", "payment-method-error")}

                <div className="mt-6 rounded-xl bg-surface-muted p-4 text-sm">
                  <p className="flex justify-between">
                    <span className="text-ink-muted">Donating to</span>
                    <span className="max-w-[60%] truncate text-right font-bold text-ink">{campaign?.title}</span>
                  </p>
                  <p className="mt-2 flex justify-between border-t border-edge pt-2">
                    <span className="text-ink-muted">Amount</span>
                    <span className="font-display text-lg text-brand-700 dark:text-brand-300">
                      {formatCurrency(amount)}
                    </span>
                  </p>
                </div>
              </section>
            )}

            {step === 3 && (
              <section aria-labelledby="step-done-heading" className="relative overflow-hidden py-4 text-center">
                {!reduceMotion && <ConfettiBurst />}
                <motion.span
                  initial={reduceMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.1 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-500 text-accent-950 shadow-xl shadow-accent-500/40"
                >
                  <PartyPopper className="h-9 w-9" aria-hidden />
                </motion.span>
                <h2 id="step-done-heading" className="mt-6 font-display text-3xl text-ink">
                  JazakAllah, {form.isAnonymous ? "kind donor" : form.donorName.split(" ")[0] || "friend"}!
                </h2>
                <p className="mx-auto mt-3 max-w-md text-ink-muted">
                  Your donation of{" "}
                  <span className="font-bold text-brand-700 dark:text-brand-300">{formatCurrency(amount)}</span> to{" "}
                  <span className="font-bold text-ink">{campaign?.title}</span> has been recorded.
                  A receipt is on its way to <span className="font-semibold">{form.email}</span>.
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs text-ink-muted/80">
                  (Demo confirmation — no real payment was processed.)
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-brand-600 px-5 py-2.5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download receipt
                  </button>
                  <Link
                    href="/campaigns"
                    className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-bold text-accent-950 transition-colors hover:bg-accent-400"
                  >
                    <HeartHandshake className="h-4 w-4" aria-hidden />
                    Explore more campaigns
                  </Link>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {step < 3 && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-ink-muted transition-colors enabled:hover:bg-surface-muted enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-7 py-3 text-sm font-bold text-accent-950 shadow-lg shadow-accent-500/25 transition-all hover:bg-accent-400"
            >
              {step === 2 ? `Donate ${amount >= 100 ? formatCurrency(amount) : ""}` : "Continue"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Deterministic pseudo-random in [0, 1) — keeps render pure. */
const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Lightweight celebratory burst rendered with framer-motion (no canvas). */
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: (prand(i, 1) - 0.5) * 360,
        y: -(60 + prand(i, 2) * 220),
        rotate: prand(i, 3) * 360,
        color: ["#8dc63f", "#1b75bb", "#48a3d6", "#a0d052", "#f59e0b"][i % 5],
        delay: prand(i, 4) * 0.25,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-24 z-10">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: 0.6 }}
          transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
          className="absolute left-1/2 h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}
