import type { NextConfig } from "next";

/**
 * Static CSP (no nonce) — the deliberate, documented tradeoff for this app:
 * a nonce-based CSP requires every page to render dynamically (Next.js's own
 * guidance), which isn't worth adopting purely for a "polish" hardening pass
 * on an internal ops dashboard. 'unsafe-inline' is needed for two concrete,
 * known reasons — not left in by default:
 *   script-src: Next.js's own inline flight-data bootstrap scripts, plus our
 *     one inline pre-paint theme script (app/layout.tsx) that avoids a flash
 *     of the wrong theme on load.
 *   style-src: this codebase uses inline `style={{...}}` throughout (chart
 *     SVGs, dynamic colors) — React renders these as literal style
 *     attributes, which CSP's style-src governs same as <style> tags.
 * This does not defend against inline-script XSS specifically — it still
 * meaningfully blocks third-party script/frame/object injection, clickjacking
 * (frame-ancestors), and mixed content (upgrade-insecure-requests).
 *
 * img-src explicitly names the 3 remote hosts from `images.remotePatterns`
 * below. Most next/image usages never need this — Next proxies them through
 * `/_next/image` on this same origin — but success-stories.tsx renders its
 * (sometimes broken, sometimes real) Cloudinary URLs with `unoptimized`, so
 * that one component's <img> really does hit the remote host directly.
 */
const isDev = process.env.NODE_ENV === "development";
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://images.unsplash.com https://res.cloudinary.com https://randomuser.me;
  media-src 'self' blob:;
  font-src 'self' data:;
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Campus/trainer/course photos the company uploads (same host their
        // existing trainer/course images already use).
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        // Placeholder student avatars present in the company's student records.
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
          // HSTS only makes sense over real HTTPS deployments (Vercel) — a
          // local http://localhost dev server should never carry this, or
          // the browser would try to force future localhost visits to HTTPS.
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
