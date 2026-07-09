import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// Site-wide typeface (portal + rest of the marketing site) — matches
// saylanimit.com's brand font.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Homepage-only typeface — a plain, professional, decent sans (no brand
// flourish), scoped via .homepage-font in app/page.tsx.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Vercel injects VERCEL_PROJECT_PRODUCTION_URL (prod) / VERCEL_URL (preview)
// with no protocol — fall back to localhost for local dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SMIT Donations — Saylani Mass IT Training",
    template: "%s | SMIT Donations",
  },
  description:
    "Donate to education, food relief, healthcare, clean water, and emergency campaigns run by SMIT — Saylani Mass IT Training. 100% donation policy, full transparency.",
  openGraph: {
    type: "website",
    siteName: "SMIT Donations",
    title: "SMIT Donations — Your giving becomes someone's tomorrow",
    description:
      "Support education, food, healthcare, clean water, and relief campaigns with full transparency.",
    images: ["/smit-app-logo.avif"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SMIT Donations",
    description: "Donate to verified campaigns with 100% transparency.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
