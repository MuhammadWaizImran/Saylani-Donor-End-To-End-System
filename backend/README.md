# Saylani NestJS backend

The existing HTTP API now runs in a standalone NestJS application. Seven domain
modules register dependency-injected controllers and services: Auth, Admin,
Chat, Dashboard, Portal, Reports and Voice. `/api/health` identifies the runtime.

Controllers call migrated, framework-independent handlers. Existing Zod
validation, MongoDB queries, ownership checks and AI tool execution are retained.
Handlers use standard Request/Response objects; `http/bridge.ts` adapts Express
requests and streams responses with backpressure and disconnect cancellation.
There are no Next.js runtime imports in the backend.

The frontend keeps the same `/api/...` URLs. Its thin route proxies forward to
`NEST_BACKEND_URL`, preserve cookie authentication and stream AI/PDF/DOCX/audio
responses. There is no automatic proxy retry, which could duplicate mutations.
Production fails closed with 503 if the backend origin is absent.

## Local development

Use Node 24 and `npm ci` at the repository root. Copy `.env.example` to
`.env.local`, supplying existing MongoDB/JWT/provider credentials. Both services
must use the same JWT secret and MongoDB database.

Terminal 1:

```sh
npm run backend:build
npm run backend:start
```

Terminal 2:

```sh
npm run dev
```

Nest defaults to port 4000. Next development forwards there unless
`NEST_BACKEND_URL` overrides it. Rebuild/restart Nest after backend edits.

## Deployment

`npm run backend:package` produces ignored `backend/deploy`, containing compiled
backend/shared libraries, dependencies manifest, report fonts and Vercel config.
It copies no environment files. Deploy that folder as `saylani-nest-backend`.
Set its MongoDB/JWT/provider credentials as sensitive environment variables.

Only after verifying that backend, set the frontend's `NEST_BACKEND_URL` to its
production HTTPS origin and deploy the frontend. Keep backend and frontend in
the same region to reduce the additional network hop. Roll back the frontend
deployment to the previous version if switching fails; do not delete the old
working deployment before verifying the replacement.

## Verification

```sh
npm run backend:build
npm run build
npm run lint
npx tsx --env-file=.env.local scripts/test-nest-api.ts
```

Set `TEST_BASE_URL` to either the Nest origin or Next frontend to verify both
paths. The test creates a uniquely named temporary account, checks login,
cookies, bearer auth, invalid JSON, permissions, dynamic routing, PDF download,
and token revocation, then removes its own records. Existing chart/layout and
chat-followup scripts also support `TEST_BASE_URL`.

## Scope and limits

This migrates all 14 existing HTTP route groups; it does not rewrite domain
logic or change the AI provider policy. Server-rendered Next dashboard pages
still call shared database read functions and verify sessions server-side.
Consequently Next still needs MongoDB and JWT credentials. Moving those reads
behind dedicated Nest query endpoints is a separate migration step.

Vercel still imposes function execution limits. Nest does not provide infinite
background execution, a job queue, increased provider quota, or automatic
database optimization. No Redis/queue/microservices were added without a
concrete current need. A single modular backend can also run on a Node host.
