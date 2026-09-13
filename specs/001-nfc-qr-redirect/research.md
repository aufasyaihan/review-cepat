# Research: NFC QR Redirect — Project Foundation

Phase 0 output for `/speckit.plan`. Resolves every technical constraint from the
command input and the canonical architecture document.

## 1. Fullstack Runtime & Framework

- **Decision**: Next.js 16.3.5, App Router, Node.js runtime. Route segments that need
  Node/DB explicitly declare `export const runtime = 'nodejs'` (this is the default; the
  edge runtime is not supported for Cache Components and cannot run Drizzle/Better Auth).
- **Rationale**: Both the command requirements and the canonical document mandate
  "Next.js 16 Fullstack (Node.js runtime)". The Node.js runtime is required for the
  MySQL Drizzle client, Better Auth server handlers, Pino, and server-side IP geolocation.
- **Alternatives considered**: `runtime = 'edge'` (rejected — no Node/DB APIs),
  Pages Router (rejected — no RSC/streaming; canonical doc mandates App Router).

## 2. Architecture Shape

- **Decision**: Domain-Based Modular Monolith in a single Next.js app. Capabilities live
  in `domains/*`; `app/` is routing and page composition only; every domain exposes the
  canonical template (`api/{client,queries,mutations}`, `server/{service,repository,
  mapper,permissions}`, `components`, `schemas`, `types`, `__tests__`).
- **Rationale**: Constitution I + IX and the canonical document. Keeping business logic in
  domain services and exposing a thin API layer means any domain (e.g. `scan`, `analytics`)
  can later be split into a standalone backend service with zero frontend rewrite.
- **Alternatives considered**: Microservices (over-engineering for MVP), a flat `src/`
  layout (violates canonical dir), logic inside `page.tsx` (explicitly forbidden).

## 3. ORM & Migrations

- **Decision**: Drizzle ORM with the `mysql2` driver; `drizzle-kit generate` +
  `drizzle-kit migrate` workflow with versioned SQL migrations in `drizzle/`.
  `drizzle.config.ts` points `schema` at `db/schema` and `out` at `./drizzle`.
- **Rationale**: Type-safe, code-first, minimal overhead; matches canonical doc. The
  generate/migrate workflow (not `drizzle-kit push`) keeps a versioned migration history,
  which the deploy script relies on (`npm run db:migrate`).
- **Alternatives considered**: `drizzle-kit push` for prototyping (rejected for
  production — no history), Prisma (heavier codegen, not in canonical stack).

## 4. Authentication & Authorization

- **Decision**: Better Auth with the Drizzle adapter (`provider: "mysql"`), mounted at
  `app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth)`. Client singleton from
  `better-auth/react` wrapped in `providers/`. RBAC via a `role` claim (`ADMIN`,
  `MERCHANT`) enforced in every domain's `server/permissions.ts`.
- **Rationale**: Constitution VII mandates Better Auth + RBAC; official Next.js
  integration is a two-file setup; Drizzle is a first-class adapter.
- **Alternatives considered**: NextAuth/Auth.js (requires add-on for Drizzle), Lucia
  (deprecated), custom session/JWT (rejected — security risk).

## 5. Data Fetching (SSR Prefetch + Hydration)

- **Decision**: Server Components call `getQueryClient()` and `prefetchQuery(...)` from
  the domain query factory (e.g. `deviceQueries.list()`), then render
  `<HydrationBoundary state={dehydrate(queryClient)}>`; client components consume via
  `useSuspenseQuery`. Every route has `loading.tsx` and/or Suspense; major layouts have
  loading/error/not-found.
- **Rationale**: Canonical "TanStack Query Pattern" and Frontend Rules 5–8. Streaming
  server-rendered data with hydration keeps client components fetch-free.
- **Alternatives considered**: SWR (different paradigm, not in stack), direct fetch in
  components (banned by constitution III), full client-side fetch (worse UX/LCP).

## 6. Public Scan Resolution (redirect vs. landing)

- **Decision**: A single public URL `GET /s/[slug]` serves both cases, because the
  physical NFC/QR encodes exactly one URL. The server component resolves the device:
  - Single-link: insert the scan event, then call Next `redirect()` → a 3xx response
    with no client-side hop (meets the "record before redirect" requirement and
    sub-2s latency target).
  - Multi-link: TanStack-prefetch the device + destinations (scan recorded in the same
    server query), then render the SEO-friendly landing page that lists links.
  - Unpublished/disabled/unclaimed/destination-less: clear inactive message (200).
- **Rationale**: Route Handlers and `page.tsx` cannot both serve `GET` on the same path
  (Route Handler wins), so a client-side hop for single-link is avoided by redirecting in
  the server component. Recording happens server-side exactly once per request — never in
  a client effect (avoids React 19/StrictMode double-invocation double-logging).
- **Alternatives considered**: Route handler 302 for single-link at a separate path
  (requires two encoded URLs — impossible on one physical tag), client-side
  `window.location` redirect after hydration (slower; flash of landing content).

## 7. Google Review Integration

- **Decision**: Google Places lookup lives in `domains/destination/server/` (an external
  adapter within the destination domain). Merchant searches places, selects one, the
  domain stores the Google `place_id` plus normalized destination name/address, and the
  review URL is derived server-side as
  `https://search.google.com/local/writereview?placeid=<PLACE_ID>`. No Places API key is
  ever exposed to the browser.
- **Rationale**: Keeps the external dependency isolated inside one domain (scalability);
  the derived URL is stable and needs no per-request API call for the public scan path.
- **Alternatives considered**: Standalone `place` domain (more seams than needed for a
  single API adapter), client-side Places autocomplete (leaks API key — rejected).

## 8. Analytics Sources

- **Decision**: Browser/device type and referrer parsed server-side from the request
  headers at scan time; country/city best-effort from request IP geolocation when a
  lookup resolves, else stored as unavailable; all stored on the scan event row; the
  analytics domain aggregates totals/daily/per-device for merchant dashboards.
- **Rationale**: Best-effort geo matches spec FR-013 ("when available") and avoids a
  client top-up request on the critical redirect path.
- **Alternatives considered**: Client-side reporting beacon after redirect (adds a
  network hop and can be blocked; rejected), paid geo service (out of MVP scope).

## 9. Deployment & CI

- **Decision**: GitHub Actions `ci.yml` (node 22, `npm ci`, lint, typecheck, test,
  coverage gate ≥90%, build) on push/PR to `main`/`develop`. Deployment via
  `scripts/deploy.sh` per the canonical script: `ssh` → `git fetch/reset --hard`,
  `npm install`, `npm run db:migrate`, `npm run build`, `pm2 restart nfc-platform`.
- **Rationale**: The canonical document ships both files verbatim; spec commands require
  GitHub Actions CI/CD and "SSH deployment script compatibility".
- **Hosting note (deferred constraint)**: spec NFR says "Hostinger Shared Hosting", but
  the canonical deploy script requires an SSH host able to run Node.js 22 and pm2 —
  that is Shared-Hosting-incompatible (classic shared hosting cannot run a long-lived
  Node server). Per the command's "follow the architecture document exactly" rule the
  plan targets a Hostinger VPS over SSH; if truly constrained to classic shared hosting,
  that is a separate deployment decision and is outside this plan.
- **Alternatives considered**: Shared hosting with cgi/PHP proxy (rejected — cannot run
  a Node/passport server), Docker image deploy (not supported on shared, unnecessary for
  MVP), manual cPanel deploy (no CI story).

## 10. Observability

- **Decision**: Pino as the only logger; a server middleware creates structured log
  records for every request (request id, method, path, status, durationMs, actor id when
  known, device slug when public); errors are re-logged with context in the global
  `app/error.tsx` handlers and domain services.
- **Rationale**: Constitution VI. One logger, structured JSON, context on errors.
- **Alternatives considered**: winston (heavier, not required), console.log (no
  structure — rejected).

## 11. UI Stack

- **Decision**: shadcn/ui as the design system components, Base UI for advanced
  primitives, Phantom UI strictly for layout (page shells, headers, navigation).
  TanStack Form field components bind to Zod schemas from `domains/*/schemas/`.
- **Rationale**: Canonical doc rules 10–12 assign each library a single responsibility.
- **Alternatives considered**: One library for everything (rejected — contradicts
  canonical separation), Tailwind-only hand-rolled (rejected — no design system).