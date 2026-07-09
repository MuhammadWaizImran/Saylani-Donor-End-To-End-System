# SMIT Donations — Frontend

A production-quality, frontend-only donation platform for **SMIT (Saylani Mass IT Training)**, built with Next.js App Router. All data is mocked behind an API-shaped data layer so a real backend can be swapped in later without touching UI components.

## Tech stack

- **Next.js 16** (App Router, Turbopack, React Compiler) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — green & white editorial theme (Instrument Serif display + Inter body), light mode only
- **Cinematic video backgrounds** (`public/media/*.mp4`) with seamless rAF fade-loop (`components/media/video-background.tsx`)
- **React Three Fiber + drei** — 3D particle overlay on the hero, plus a pulsing heart/globe scene in the Mission section
- **Framer Motion** — fade-rise entrances, scroll reveals, animated progress bars/counters, wizard transitions, confetti
- **lucide-react** icons (+ inline SVG brand/social icons)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Pages

| Route | Description |
| --- | --- |
| `/` | Fullscreen video hero + 3D particles, live stats bar, donation ticker, featured campaigns, 3D mission section, fullscreen impact-video section, trust pillars, testimonials |
| `/campaigns` | Grid with search + category/urgency/location filters (`?status=urgent` deep-links) |
| `/campaigns/[id]` | Story, gallery, animated progress, amount selector, recent donors, share buttons |
| `/donate` | 4-step wizard: amount → donor details → payment method (JazzCash/Easypaisa/bank/card UI) → animated confirmation |
| `/about` | Mission, impact stats, timeline, team, certifications/trust badges |
| `/dashboard` | Mock donor dashboard: history table, receipt buttons, saved payment methods |
| `/contact` | Validated contact form, WhatsApp/phone/email links, embedded map |

## Project structure

```
app/                  # Routes (App Router)
components/
  layout/             # Header (sticky, mobile menu), footer, newsletter form
  home/               # Hero, stats bar, ticker, trust, testimonials
  campaigns/          # Card, explorer (filters), gallery, donation panel, donors, share
  donate/             # 4-step donation wizard
  three/              # R3F hero scene + quality-degrading loader
  ui/                 # Logo, badges, progress bar, counter, theme toggle, skeletons
lib/
  api.ts              # ★ Data layer — swap these functions for real API calls later
  mock-data/          # Campaigns, donations, donors, testimonials, team
  utils.ts            # Currency (PKR), percent, time-ago helpers
types/                # Shared TypeScript interfaces (Campaign, Donation, Donor…)
```

## Backend swap plan

Every component gets data through the async functions in `lib/api.ts` (`getCampaigns()`, `getCampaign(id)`, `getDonations(campaignId)`, `getSiteStats()`, …). To connect a real backend/Supabase, replace only those function bodies — signatures and types are already API-shaped.

## Notes

- **No real payments** — the payment step is UI only; the confirmation screen says so explicitly.
- **Performance** — 3D layers lazy-load client-side only, drop particle count/DPR on mobile, and are skipped entirely under `prefers-reduced-motion`.
- **Theming** — white-only, green accents (`brand-*` deep greens, `accent-*` bright greens in `globals.css`). Dark mode was removed by request.
- **Media** — real photos/videos live in `public/media/` (sourced from the project's "videos and images" folder).
- **Accessibility** — semantic landmarks, skip link, labeled forms with inline validation, `aria` on progress bars/steps, keyboard-reachable controls.
