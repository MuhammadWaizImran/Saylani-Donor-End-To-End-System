# SMIT Portal

A role-based management dashboard for **SMIT (Saylani Mass IT Training)** — campuses, students, trainers, courses, and an AI operations assistant, backed by a single MongoDB database. There is no public website; the app opens straight to login.

## Tech stack

- **Next.js 16** (App Router, Turbopack, React Compiler) + **React 19** + **TypeScript**
- **MongoDB** (official `mongodb` driver) — the single data backend
- **Auth** — custom JWT sessions (`jose`, HS256, httpOnly cookie) + `bcryptjs`; no third-party auth provider
- **AI** — Groq (`gpt-oss-120b` → `llama-3.3-70b-versatile` fallback) tool-calling agent with role-scoped read/write tools
- **Voice** — ElevenLabs TTS (optional) + browser Web Speech STT
- **Documents** — `docx` reports generated on demand, stored in MongoDB GridFS
- **Tailwind CSS v4** — SMIT blue + green theme, light mode only
- **Framer Motion**, **lucide-react**

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000 (redirects to /auth/login)
npm run build           # production build
npm run lint
npm run db:indexes      # ensure MongoDB indexes (safe to re-run)
npm run seed:test-admin # create a known-password admin account for local testing
npm run e2e             # smoke test: login per role + list counts
```

Required environment variables (`.env.local`, gitignored) — see `.env.example`:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (expanded non-SRV form) |
| `AUTH_JWT_SECRET` | Signs session cookies |
| `GROQ_API_KEY`, `GROQ_API_KEY_2` | AI assistant, with failover |
| `ELEVENLABS_API_KEY` | Optional — voice replies; falls back to the browser's built-in voice without it |

## Routes

| Area | Routes |
| --- | --- |
| Auth | `/auth/login` (3 role tabs), `/auth/signup` (donor only) |
| Admin | `/portal/admin` and its campuses/students/trainers/courses/classes/jobs/success-stories/data-entry/assistant subpages |
| Trainer | `/portal/trainer`, `/portal/trainer/assistant` (scoped to the signed-in trainer only) |
| Donor | `/portal/donor` (read-only org impact view) |
| API | `/api/auth/*`, `/api/chat`, `/api/portal/trainer`, `/api/admin/records`, `/api/reports/[id]`, `/api/voice/tts` |

## Project structure

```
app/                    # Routes (App Router) — all behind /auth or /portal
components/portal/      # Portal shell, AI assistant, data-entry forms, shared UI
lib/
  management-api.ts     # ★ Single data-access layer for campuses/students/trainers/courses/classes
  mongodb.ts            # Connection singleton
  auth.ts / auth-server.ts / auth-jwt.ts   # Session issuing/verification
  ai/tools.ts           # AI agent's read + write tools (role-gated server-side)
  ai/report.ts          # Word report generation → GridFS
scripts/                # auth-seed, seed-test-admin, ensure-indexes, e2e-test
```

## Data model

Training data lives in ~47 MongoDB collections. Two hubs almost everything else references:

- **`student_inductions`** — one enrolment (campus, course, trainer, slot, status); a UI "student" = this joined to `students` (personal info).
- **`slots`** — one running class (trainer, campus, capacity, schedule).

Names are stored bilingually (`en`/`ur`) and resolved through short-lived cached lookup maps.

## Known limits

- No placement/salary data exists in the source system — the Jobs page reflects that honestly rather than fabricating numbers.
- Progress/attendance are derived from enrolment status, not tracked per-student percentages.
- Voice replies are premium-quality only once `ELEVENLABS_API_KEY` is set.

## Security notes

- Roles/identity always come from the verified session cookie, never the client.
- Any credential ever pasted into a chat/log (DB passwords, API keys) should be rotated before relying on this build in production.
