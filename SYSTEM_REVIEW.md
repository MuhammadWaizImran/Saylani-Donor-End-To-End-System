# SMIT portal review

Reviewed 9 September 2026. This is a source review of the supplied project, with local startup and static checks recorded below. Live database contents and authenticated workflows cannot be verified without configuration.

## Architecture and features

- Next.js 16.2.10 App Router, React 19, TypeScript, Tailwind CSS 4, React Compiler, Framer Motion.
- One Next.js process serves the UI and API routes. MongoDB is the external persistence layer; no separate backend server is included.
- `app/auth`: role-based login and donor-only signup. Admins authenticate against `users`, trainers against `trainers`, donors against `portal_donors`.
- `app/portal/admin`: overview, campuses, students, trainers, courses, classes, attendance, donations, fee payments, success stories, data entry, AI assistant, and entity detail pages.
- `app/portal/trainer`: personal training dashboard and AI assistant. The trainer API resolves the signed-in trainer and scopes student/course queries.
- `app/portal/donor`: organization impact, campus statistics, and classroom activity. No payment checkout or donor contribution-management workflow was found.
- `components/portal`: navigation shell, charts, lists, filters, forms, assistant UI, report export, and automatic refresh every eight seconds while visible.
- `lib/management-api.ts`: shared reads, MongoDB aggregation, mappings, lookup caching, and pagination. Several lists load complete datasets before paginating.
- `lib/ai/tools.ts` and `app/api/chat/route.ts`: schema discovery, scoped queries, analytics, admin mutations, streamed progress, OpenRouter/Groq provider fallback, and report generation.
- `lib/ai/chat-store.ts`: conversations stored by owner in MongoDB.
- Reports: Word files stored in GridFS; sponsorship PDF generated on request. Voice: browser speech plus optional ElevenLabs TTS.

## Data relationships

`students` holds personal details. `student_inductions` holds enrolments and references the person, campus, trainer, catalog course, course offering, and optionally a slot. Thus an enrolment count is not necessarily a count of unique people.

`courses` is the course catalog; `new_courses` is the offering/batch. `slots` represents scheduled classes. `campus` references cities. Names often live inside bilingual `en`/`ur` objects. Foreign keys may be strings or ObjectIds, requiring careful handling.

Student tuition (`payments`) and charitable fundraising (`donations`, `campaigns`) are separate domains. Keep their totals and labels separate.

## Findings to address

### High priority

1. **Revocation is not checked before most dashboard reads.** `proxy.ts` verifies signature, expiry, and role but deliberately skips revoked sessions. Most server pages do not call `requireRole`; `app/portal/layout.tsx` wraps them in a client shell. Only the profile page calls that server helper. A retained, revoked but unexpired cookie can therefore still reach server-rendered dashboard data. Apply verified-session checks at the data access boundary and relevant server pages. `lib/auth-jwt.ts` also treats revocation-store failures as not revoked.
2. **Data-entry forms discard accepted fields.** In `app/api/admin/records/route.ts`, campus establishment year, trainer specialization/join date, course trainer/duration/start date, and class name are accepted but omitted from inserted records. Trainer salary is stored as `hourly_rate`, requiring a clear units decision. Newly created trainers have no password or invitation path and cannot log in through the existing password-based flow.
3. **Related writes are not atomic.** Creating a student then an induction, or a catalog course then an offering, uses separate inserts without transactions. A second-write failure leaves partial records. Submitted foreign keys also need existence and relationship validation.
4. **AI deletion confirmation relies on a prompt.** Admin-only checks exist, as do some dependency checks, but `delete_record` has no server-enforced confirmation token. The chat handler also accepts message objects without runtime role/content validation, and executes all tool calls in a round concurrently, including writes. Add validated messages, shared mutation schemas, explicit confirmation for destructive actions, and ordered execution for dependent writes.

### Other concrete improvements

- `lib/mongodb.ts` caches the connection promise even after initial connection failure, so subsequent calls reuse that rejection until the module/process restarts.
- Login and signup have no application-level rate limiter. Database failures can escape as unhandled server errors rather than useful configuration/service-unavailable responses.
- Donor signup checks existence then inserts; the supplied email indexes are not unique. Concurrent requests can create duplicate accounts.
- `query_collection` rejects top-level operator field names but accepts object-valued filters and does not fully validate field names/types. Trainer scoping is conditional on known schema fields; audit every allowed collection and deny private collections that cannot be scoped.
- Schema discovery includes hardcoded approximate counts. `query_collection` returns an empty result immediately for collections whose stored `approxDocs` is zero, which can conceal newly added live data.
- AI provider requests have no explicit timeout. Conversation messages accumulate in one MongoDB document, and conversation listing loads messages rather than only summary metadata.
- `deriveProgress` and `deriveAttendance` use fixed numbers based on enrolment status. These are not measured percentages and should not become factual dashboard/report values in future changes.
- GridFS expiry indexes delete file metadata only; there is no matching chunk cleanup in the supplied index script. Downloads also do not explicitly reject an expired timestamp before TTL cleanup runs.
- Eight-second refreshes plus full-list loading may become expensive with larger datasets. Measure with representative data before optimizing queries, pagination, and refresh frequency.
- README is behind the source: it describes light-only styling and Groq-first AI, and lists a jobs route that is absent. Current navigation includes attendance, donations, and fee payments; a theme toggle and OpenRouter-first provider configuration exist.

## Configuration and development

The supplied folder has `.env.example` but no `.env.local`, no installed dependencies initially, and no Git repository metadata. Set `MONGODB_URI` and `AUTH_JWT_SECRET` locally to enable sign-in and persisted workflows. Configure OpenRouter or Groq for AI, and optionally ElevenLabs for voice. Do not put credentials in this report or commit them.

Some management reads have bundled mock fallbacks when MongoDB is absent. Authentication still requires MongoDB; this is not a complete standalone demo mode.

Existing commands cover development, production build, TypeScript, lint, index setup, test account creation, data verification, and live end-to-end tests. Seeding/security scripts can change database records; review their targets before running them. The CI live-test command includes `--env-file=.env.local` although the workflow supplies environment variables without creating that file.

## Suggested change sequence

1. Configure a development database and establish authenticated baseline checks for all three roles.
2. Fix session verification, data-entry persistence, foreign-key validation, and atomic writes.
3. Harden AI mutation validation, confirmation, and collection scoping.
4. Implement the requested UI/features using shared data services so forms and AI obey the same rules.
5. Update docs and run type/lint/build plus targeted integration checks on a disposable database.

No application source or database records were changed during this review.

## Local verification results

- Installed the locked dependency set with `npm ci` (524 packages).
- Started Next.js development server at `http://127.0.0.1:3000` and visually verified the login page in Chrome. The preview tab is left open.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm audit`: eight reported vulnerabilities (one moderate, six high, one critical). The audit marks Next.js as critical; see `dependency-audit.json` for package/advisory details. No automatic upgrades were applied.
- Production build and authenticated/database/AI end-to-end tests were not run. Dashboard analysis is based on source, not a live-data walkthrough.
