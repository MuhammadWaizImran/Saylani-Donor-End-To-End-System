import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact & Support",
  description:
    "Reach the SMIT donations team — WhatsApp, phone, email, or visit our head office in Karachi.",
};

const channels = [
  {
    icon: MessageCircle,
    title: "WhatsApp",
    value: "+92 311 1729526",
    href: "https://wa.me/923111729526",
    note: "Fastest response — 9am to 9pm",
  },
  {
    icon: Phone,
    title: "Phone",
    value: "(021) 111-729-526",
    href: "tel:+9221111729526",
    note: "Donation helpline, 7 days a week",
  },
  {
    icon: Mail,
    title: "Email",
    value: "donations@smit.example.org",
    href: "mailto:donations@smit.example.org",
    note: "Receipts, refunds & general queries",
  },
  {
    icon: Clock,
    title: "Office hours",
    value: "Mon–Sat, 9am–6pm",
    note: "Closed on public holidays",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-2xl">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">
          Contact & support
        </p>
        <h1 className="font-display text-4xl tracking-tight text-ink">
          We answer every message
        </h1>
        <p className="mt-3 text-ink-muted">
          Questions about a campaign, a receipt, or where your donation went?
          That&apos;s exactly what we&apos;re here for.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
        <ContactForm />

        <div className="space-y-4">
          {channels.map(({ icon: Icon, title, value, href, note }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl border border-edge bg-surface p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-950 dark:text-accent-400">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-bold text-ink">{title}</h2>
                {href ? (
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-ink">{value}</p>
                )}
                <p className="mt-0.5 text-xs text-ink-muted">{note}</p>
              </div>
            </div>
          ))}

          <div className="overflow-hidden rounded-2xl border border-edge bg-surface">
            <div className="flex items-center gap-2 border-b border-edge px-5 py-3">
              <MapPin className="h-4 w-4 text-accent-600" aria-hidden />
              <p className="text-sm font-bold text-ink">Head office — Karachi</p>
            </div>
            <iframe
              title="SMIT head office location on Google Maps"
              src="https://www.google.com/maps?q=Saylani%20Welfare%20International%20Trust%20Bahadurabad%20Karachi&output=embed"
              className="h-64 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <p className="px-5 py-3 text-xs text-ink-muted">
              A-25, Bahadurabad Chowrangi, Karachi, Pakistan
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
