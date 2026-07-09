import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  XTwitterIcon,
  YoutubeIcon,
} from "@/components/ui/social-icons";
import { Logo } from "@/components/ui/logo";
import { NewsletterForm } from "@/components/layout/newsletter-form";

const footerColumns = [
  {
    heading: "Explore",
    links: [
      { label: "All Campaigns", href: "/campaigns" },
      { label: "Urgent Appeals", href: "/campaigns?status=urgent" },
      { label: "Contact & Support", href: "/contact" },
      { label: "Portal Login", href: "/auth/login" },
    ],
  },
  {
    heading: "Donors",
    links: [
      { label: "Donate Now", href: "/donate" },
      { label: "Browse Campaigns", href: "/campaigns" },
      { label: "Reach Us", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Refund Policy", href: "#" },
      { label: "Contact & Support", href: "/contact" },
    ],
  },
];

const socials = [
  { label: "Facebook", href: "https://facebook.com", Icon: FacebookIcon },
  { label: "Instagram", href: "https://instagram.com", Icon: InstagramIcon },
  { label: "Twitter / X", href: "https://twitter.com", Icon: XTwitterIcon },
  { label: "YouTube", href: "https://youtube.com", Icon: YoutubeIcon },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: LinkedinIcon },
];

export function Footer() {
  return (
    <footer className="border-t border-edge bg-brand-950 text-brand-100">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)_1.4fr]">
          <div>
            <Logo className="[&_span]:!text-brand-100" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-brand-300">
              Saylani Mass IT Training — serving humanity through education,
              food, healthcare, and relief. Every rupee tracked, every donor
              answered.
            </p>
            <div className="mt-5 flex gap-2">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-brand-300 transition-colors hover:bg-accent-500 hover:text-accent-950"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="font-display text-sm uppercase tracking-wider text-accent-400">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-brand-200 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h3 className="font-display text-sm uppercase tracking-wider text-accent-400">
              Stay in the loop
            </h3>
            <p className="mt-4 text-sm text-brand-300">
              Monthly impact updates. No spam, ever.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-brand-900 pt-6 text-xs text-brand-400 sm:flex-row">
          <p>
            © {new Date().getFullYear()} SMIT — Saylani Mass IT Training. All
            rights reserved.
          </p>
          <p>
            Demo build with mock data — no real payments are processed on this
            site.
          </p>
        </div>
      </div>
    </footer>
  );
}
