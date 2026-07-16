# SMIT Dashboard — Complete Rebuild Prompt (Portal Only)

> Copy everything below the line into any capable AI coding assistant to recreate the
> **management dashboard** from scratch. Scope = the role-based portal that lives behind
> login (Admin, Trainer, Donor) plus its AI assistant, data layer, and APIs.
> **Out of scope:** the public marketing/donation website — this brief builds the dashboard only.

---

## ROLE & GOAL

You are a senior full-stack engineer + product designer. Build a **bilingual (English/Urdu)
role-based management dashboard** for **SMIT (Saylani Mass IT Training)**, a non-profit that runs
free IT campuses. The dashboard is the **private, post-login portal** used to run the organization:

- **Admin** — full org: campuses, students, trainers, courses, classes, placements, data entry, AI.
- **Trainer** — only their own students, courses, classes (server-scoped).
- **Donor** — read-only impact dashboard.

Plus an **AI operations assistant** across the portal. Everything runs on **one MongoDB database**.

There is **no public website** in this build — the app opens at `/auth/login` and everything lives
under `/portal/*`.

---

## 1. TECH STACK (use exactly this)

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Turbopack, React Compiler) |
| Language | **TypeScript 5** (strict) |
| UI | **React 19** |
| Styling | **Tailwind CSS v4** (CSS-first `@theme`, no `tailwind.config.js`) |
| Icons | **lucide-react** |
| Animation | **framer-motion** |
| Database | **MongoDB** (official `mongodb` driver v7) — single backend |
| Auth | Custom: **jose** (HS256 JWT in httpOnly cookie) + **bcryptjs** |
| AI | **Groq API** — `gpt-oss-120b` → `llama-3.3-70b-versatile` fallback, tool-calling |
| Voice | **ElevenLabs** (Flash v2.5, voice "Rachel") TTS + browser Web Speech STT |
| Docs | **docx** for Word reports, stored & served from **MongoDB GridFS** |
| Validation | **zod** on all write endpoints |

Environment variables (`.env.local`, gitignored):
`MONGODB_URI`, `AUTH_JWT_SECRET`, `GROQ_API_KEY`, `GROQ_API_KEY_2`, `ELEVENLABS_API_KEY`.

---

## 2. DESIGN SYSTEM (match these tokens exactly)

The brand is lifted from **saylanimit.com** — a professional **blue + bright-green** identity on
white. **Light theme only** (`color-scheme: light`); do not build a dark theme.

### 2.1 Color tokens (Tailwind v4 `@theme`)

```css
@theme inline {
  /* SMIT blue — primary */
  --color-brand-50:  #eaf4fc;  --color-brand-100: #d6e9f7; --color-brand-200: #c2dbf3;
  --color-brand-300: #9dcdea;  --color-brand-400: #6bb3e0; --color-brand-500: #3a96d4;
  --color-brand-600: #1584c9;  --color-brand-700: #0b73b7; /* PRIMARY */
  --color-brand-800: #005a94;  --color-brand-850: #004d80; --color-brand-900: #003d66;
  --color-brand-950: #00263f;

  /* SMIT bright green — accent */
  --color-accent-50:  #f5faeb; --color-accent-100: #e8f4d1; --color-accent-200: #d3eaa8;
  --color-accent-300: #b8dc78; --color-accent-400: #9fd156; --color-accent-500: #8cc544; /* ACCENT */
  --color-accent-600: #6da800; --color-accent-700: #558124; --color-accent-800: #446621;
  --color-accent-900: #3a561f; --color-accent-950: #1d2f0c;

  /* neutrals */
  --color-surface:       #ffffff;
  --color-surface-muted: #f3f7fa;   /* blue-tinted off-white */
  --color-ink:           #0e1d29;   /* near-black, blue bias */
  --color-ink-muted:     #6f6f6f;
  --color-edge:          #dde8ef;   /* hairline borders */
}
```

**Usage rules:** brand-700 is the primary action/link blue; accent-500/600 is the green used for
success, highlights, and blue→green gradients. Text selection = accent-300 on `#0c1407`.

### 2.2 Typography

- **Montserrat** everywhere (`--font-sans` and `--font-display`), weight 700 for h1–h3 with
  `letter-spacing: -0.02em`. Load via `next/font`.
- Accent words inside headings use `<em>` but rendered **non-italic**, colored `#6F6F6F`
  (e.g. "Organization *at a glance*").

### 2.3 Signature component — the "portal glow" card

Every portal card/table/panel uses a `.portal-glow` class: a **1.5px animated gradient border**
(brand-500 → accent-500 → brand-400 → accent-400, 300% background, 7s ease-in-out shift) traced via
a masked `::before`, plus a soft blue/green ambient shadow that **lifts (-2px) and brightens on
hover**. This is the dashboard's visual signature — reuse it on all cards, stat tiles, and tables.

```css
.portal-glow { position: relative; isolation: isolate;
  box-shadow: 0 0 0 1px rgba(11,115,183,.07), 0 6px 20px -8px rgba(11,115,183,.18);
  transition: box-shadow .3s, transform .2s; }
.portal-glow::before { content:""; position:absolute; inset:-1px; z-index:-1; border-radius:inherit;
  padding:1.5px; background:linear-gradient(115deg,var(--color-brand-500),var(--color-accent-500),
  var(--color-brand-400),var(--color-accent-400)); background-size:300% 300%; opacity:.4;
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude; animation:portal-glow-shift 7s ease-in-out infinite; }
.portal-glow:hover { transform:translateY(-2px);
  box-shadow:0 0 0 1px rgba(11,115,183,.16), 0 14px 32px -10px rgba(109,168,0,.3), 0 10px 28px -8px rgba(11,115,183,.28); }
.portal-glow:hover::before { opacity:1; }
@keyframes portal-glow-shift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
```

Also define a `fade-rise` animation (0.8s ease-out, `translateY(20px)→0` + fade) with 0.2s / 0.4s
delayed variants for content entrances. Respect `prefers-reduced-motion` (kill all animation/transition).

### 2.4 Reusable UI primitives (build once, in `components/portal/ui.tsx`)

- **`StatCard`** — `portal-glow` rounded-2xl white card; top-left 40×40 rounded-xl icon chip in
  `bg-accent-50 text-accent-700`; big `font-display text-3xl` value; uppercase tracked label in
  ink-muted; optional sub-line.
- **`MiniProgress` / `BarList`** — progress bars filled with `bg-gradient-to-r from-brand-600 to-accent-500`
  on a `bg-surface-muted` track. BarList = labeled horizontal bars (used for campus performance).
- **`Pill`** — rounded-full ring-inset badge, tones: `green` (accent), `gray`, `dark` (brand),
  `red`, `amber`. Encodes status.
- **`PortalHeading`** — `font-display text-3xl/4xl` title + non-italic `<em>` accent word + muted description.
- **`TableShell` / `Th` / `Td`** — `portal-glow` overflow-x-auto rounded table; header row on
  `bg-surface-muted`, uppercase tracked `Th`, hover `bg-surface-muted/60` rows.
- **`Avatar`** — initials on a `from-brand-600 to-accent-500` gradient circle.

---

## 3. LAYOUT — the Portal Shell

One `PortalShell` client component wraps every screen. Max width **1400px**.

- **Left sidebar** (desktop, `w-64`, sticky under a 72px topbar): background
  `bg-gradient-to-b from-white via-white to-brand-50/30`, right hairline border. Header shows
  `"{role} portal"` in uppercase accent-600 tracking + a collapse button.
  - **Nav links**: rounded-xl, `font-semibold text-sm`. **Active** = `bg-gradient-to-r from-brand-50
    to-accent-50/70 text-brand-800`, a **left gradient rail** (brand-500→accent-500 with green glow),
    and a white icon chip. Inactive = ink-muted, hover slides `translate-x-0.5` and lightens.
  - Bottom: "Log out" (hovers red).
  - **Collapsed state** = 14px icon-only strip; active icon becomes a `from-brand-600 to-accent-500`
    gradient tile with green glow.
- **Topbar** (72px, white, bottom border): mobile hamburger + logo; "Signed in as **{name}**";
  right side a role pill (`bg-accent-50 text-accent-800` uppercase) + Avatar.
- **Mobile**: sidebar collapses into a hamburger drawer.
- **Route guarding** (client): if session is `null` → redirect `/auth/login`; if the path's
  required role ≠ session role → redirect to that role's home. `/portal` bounces to role home.
- Loading state: centered pulsing "Loading your dashboard…".

Role → nav map:
- **admin**: Dashboard, Campuses, Students, Trainers, Courses, Active Classes, Jobs Secured,
  Success Stories, Data Entry, AI Assistant.
- **trainer**: Dashboard, AI Assistant.
- **donor**: Dashboard.

Icons (lucide): LayoutDashboard, Building2, GraduationCap, Users, School, CalendarClock,
Briefcase, Star, FilePlus2, Sparkles, LogOut.

---

## 4. AUTHENTICATION (3 roles)

- **`POST /api/auth/login`** — body `{ email, password, role }`. Look up the collection for the
  role, `bcrypt.compare`, then sign a JWT `{ userId, name, email, role }` (7-day expiry, HS256,
  `AUTH_JWT_SECRET`) and set httpOnly cookie **`smit_session`**.
- **`POST /api/auth/signup`** — donor self-service only → writes `portal_donors`.
- **`POST /api/auth/logout`** — clears the cookie. **`GET /api/auth/session`** — returns current session.
- **Server helpers**: `getSessionUser()` (reads/verifies cookie or `Bearer`), `requireRole(role)`.
- **Client**: `login/signUp/logout/useSession` hitting `/api/auth/*`.
- **Where accounts live**: admins → `users` (role `super_admin` maps to `admin`); trainers →
  `trainers` (own login); students → `students`; portal donors → `portal_donors`.
- **Login page** `/auth/login` — 3 role tabs (Admin / Trainer / Donor). **Signup** `/auth/signup` — donor only.

**Rule:** roles/identity always come from the verified cookie, never the request body/client.

---

## 5. ADMIN DASHBOARD (10 screens)

Every list is **server-side searched + filtered + paginated** with a true `countDocuments()`
(never full-collection scans). Names resolve through cached lookup maps.

1. **Dashboard** `/portal/admin` — `PortalHeading` "Organization *at a glance*", then:
   - **8 StatCards** (2-col mobile / 4-col desktop): Total campuses, Total students, Trainers,
     Running courses, Active classes, Students placed, Avg placement salary (`per month`),
     Avg student progress (`% + avg attendance` sub).
   - **Campus-wise performance** (`BarList`, links to Campuses) + **Recent job placements**
     (avatar list w/ salary + company, links to Jobs) — 2-col.
   - **Campus summary** `TableShell`: Campus | Students | Trainers | Courses | Placement rate
     (green %), "+N more campuses" footer.
2. **Campuses** `/portal/admin/campuses` — card grid, each with live student/trainer/course counts, searchable.
3. **Students** `/portal/admin/students` — roster table: name, campus, course, trainer, status,
   progress, attendance, placement. Filters: campus, status, placement. Paginated.
4. **Trainers** `/portal/admin/trainers` — campus, specialization, student load, batch count. Searchable + paginated.
5. **Courses** `/portal/admin/courses` — campus, status, enrollment. Filter by campus/trainer/status.
6. **Active Classes** `/portal/admin/classes` — running sessions from `slots`: trainer, campus, capacity, schedule.
7. **Jobs Secured** `/portal/admin/jobs` — placements: employer + salary + summary cards.
8. **Success Stories** `/portal/admin/success-stories` — graduate stories with a word-by-word
   `fade-rise` entrance, photos, testimonials (real + clearly-marked demo).
9. **Data Entry** `/portal/admin/data-entry` — validated forms to add campus / trainer / course /
   student / class → writes straight to MongoDB (`/api/admin/records`, zod).
10. **AI Assistant** `/portal/admin/assistant` — full agent, read **and** write (section 8).

---

## 6. DONOR DASHBOARD (`/portal/donor`, 1 screen)

Transparency dashboard: org-wide impact StatCards (campuses, students, careers launched, funds
raised), campus-by-campus performance, a "lives changed" feed (recent placements), and the donor's
own receipt history. **Read-only.**

## 7. TRAINER DASHBOARD (2 screens, server-scoped)

- **Dashboard** `/portal/trainer` — only this trainer's students/courses/campus/stats, loaded from
  `GET /api/portal/trainer` which keys off the **verified session** (a trainer can never fetch
  another's data).
- **AI Assistant** `/portal/trainer/assistant` — same agent, **read-only**, auto-scoped to their students.

---

## 8. AI ASSISTANT — "Saylani Intelligence"

`POST /api/chat`, session-gated (admin/trainer). Groq tool-calling agent with **two behaviours**:

- **Companion mode** — greetings/small-talk/advice in English, Urdu, or Roman Urdu. No tools.
- **Agent mode** — any task or data question → calls tools, uses **real numbers only**, never invents.

**Engine:** model chain `gpt-oss-120b` → `llama-3.3-70b-versatile`; **two Groq keys** with
auto-failover on rate-limit; agent loop up to **6 tool rounds**; if every key fails, degrade to an
offline data-driven "mock brain" instead of erroring.

**Role scoping:** identity/role from the verified session; **writes are admin-only**, enforced
inside each tool before any DB call. Deletes: confirm first, refuse if dependents exist.

**Tools (dashboard scope):**
- *Reads:* `get_org_stats`, `list_campuses`, `list_students`, `list_trainers`, `list_courses`,
  `list_active_classes`, `list_placed_students`.
- *Writes (admin-only):* `create_campus`, `create_trainer`, `create_course`, `create_student`,
  `create_active_class`, `update_record`, `delete_record`, `generate_word_report`.

**Voice layer:** Listen (browser Web Speech, EN/UR) → Think (same `/api/chat`) → Speak
(ElevenLabs Flash v2.5 via a server proxy that hides the key; browser-voice fallback; tap-to-barge-in).

**Word reports:** `generate_word_report` builds a branded `.docx` (blue `#0B73B7` headers, green
`#6DA800` wordmark, zebra rows) with the `docx` lib, stores it in **GridFS bucket `reports`**, and
serves it via `GET /api/reports/[id]` (gated to admin/trainer).

---

## 9. DATA MODEL (MongoDB, ~47 collections, 2 hubs)

All screens go through **one data-access module** — `lib/management-api.ts`. Pages **never** touch
MongoDB directly; keep this the single choke-point so screens don't depend on the DB shape.

**The two fact hubs everything references:**
- **`student_inductions`** — one enrolment = one student in one batch (campus, course, trainer,
  slot, section, status, roll_number). Payments/attendance/results/certificates point here.
- **`slots`** — one running class (new_course, trainer, campus, capacity, booked, schedule).

**Key shapes / joins:**
- A UI "student" = **`students`** (personal: name, email, cnic, dob) **⋈ `student_inductions`**
  (enrolment) via `$lookup`.
- **`campus`** (`city` is an ObjectId → `cities`, which has bilingual `en`/`ur` names); `countries`.
- **`courses`** = catalog (bilingual `course_name`); **`new_courses`** = a course *offering/batch*
  (course ref, campus, batch_number, status) — this maps to the UI "Course".
- **`trainers`** (bilingual name, email, campus, hourly_rate, courses[]).
- **`users`** (admin auth: bcrypt password, role, campus[]); **`portal_donors`** (donor accounts).

Store names **bilingually** (`{ en, ur }`) and resolve through cached maps so list pages stay fast.
Index every FK-shaped field used in filters (`campus`, `course`, `new_course`, `trainer`, `status`).

---

## 10. API SURFACE (all routes verify the session first)

| Method | Route | Purpose | Access |
|---|---|---|---|
| POST | `/api/auth/login` | verify creds, issue cookie | public |
| POST | `/api/auth/signup` | create donor account | public |
| POST | `/api/auth/logout` | clear cookie | any |
| GET | `/api/auth/session` | current session | any |
| POST | `/api/chat` | AI agent loop | admin·trainer |
| GET | `/api/portal/trainer` | signed-in trainer's own data | trainer |
| GET·POST | `/api/admin/records` | data-entry dropdowns & inserts | admin |
| GET | `/api/reports/[id]` | download Word report (GridFS) | admin·trainer |
| POST | `/api/voice/tts` | ElevenLabs TTS proxy | admin·trainer |

---

## 11. HONEST DATA LIMITS (build the UI to reflect these truthfully)

- **No placement/salary data exists** in the real source — no student is truly "placed"; the Jobs
  page and placement stats must reflect that honestly, not fabricate numbers.
- **Progress & attendance are derived** from enrolment *status* (the DB stores status, not
  per-student %). Present them as computed indicators.
- Voice is premium only once `ELEVENLABS_API_KEY` is set (else browser fallback voice).

---

## 12. QUALITY BAR

- Server Components for data pages; `"use client"` only where interactivity needs it.
- Keep the data-access layer's function signatures stable so screens never depend on the DB shape.
- Accessible: keyboard focus states, `aria-current` on active nav, `role="progressbar"`, labeled icons.
- `overflow-x: auto` wrappers on every table; `prefers-reduced-motion` honored.
- Never trust the client for role; never invent data in the AI; confirm before destructive writes.
- Secrets only in `.env.local` (gitignored); flag any pasted credential for rotation before launch.

**Deliver a running app**: `npm run dev`, a seed script for auth (one admin/trainer/donor), and an
e2e smoke test that logs in per role and checks each list count against `countDocuments()`.
