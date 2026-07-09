import { BadgeCheck, Banknote, Eye, GraduationCap } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";

const pillars = [
  {
    icon: Eye,
    title: "Radical transparency",
    body: "Every campaign publishes what was raised, what was spent, and photos of the outcome. Donors who fund wells or sponsorships receive direct proof of their impact.",
  },
  {
    icon: Banknote,
    title: "100% donation policy",
    body: "Administrative costs are covered separately, so every rupee you give to a campaign reaches its beneficiaries in full.",
  },
  {
    icon: GraduationCap,
    title: "Education-first mission",
    body: "As Pakistan's largest free IT training initiative, we believe the best charity creates earners — our programs turn beneficiaries into providers.",
  },
  {
    icon: BadgeCheck,
    title: "Registered & audited",
    body: "Saylani Welfare is a registered charity with independently audited accounts, serving communities across Pakistan for over two decades.",
  },
];

export function TrustSection() {
  return (
    <section id="trust" className="bg-brand-950 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why donors trust SMIT"
          title="Built on decades of showing our work"
          description="Giving is an act of trust. Here is how we make sure that trust is never misplaced."
          className="[&_h2]:text-white [&_p:last-child]:text-brand-300"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-brand-900 bg-brand-900/50 p-6 transition-colors hover:border-accent-600/50"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display text-lg text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-300">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
