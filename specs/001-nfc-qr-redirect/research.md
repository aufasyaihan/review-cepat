# Research: NFC QR Redirect — Project Foundation (Regenerated)

Phase 0 output for `/speckit.plan`. Resolves every technical constraint from the
command input, the canonical architecture document, and the clarified spec
(Session 2026-09-13 + 2026-09-14).

## 1. Fullstack Runtime & Framework

- **Decision**: Next.js 16.3.5, App Router, Node.js runtime. Route segments that need
  Node/DB explicitly declare `export const runtime = 'nodejs'`.
- **Rationale**: Command requirements and the canonical document mandate Next.js 16
  with Node.js runtime, required for MySQL Drizzle, Better Auth, Pino, IP geolocation.
- **Alternatives considered**: edge runtime (no Node/DB APIs), Pages Router (no
  RSC/streaming).

## 2. Architecture Shape

- **Decision**: Domain-Based Modular Monolith in a single Next.js app; capabilities in
  `domains/*`; `app/` only routes and composes; each domain exposes the canonical
  template. Six domains: `auth`, `merchant`, `device`, `destination`, `scan`,
  `analytics`.
- **Rationale**: Constitution I + IX; any domain can later split into a backend service.
- **Alternatives considered**: microservices (over-engineering), logic in `page.tsx`
  (forbidden).

## 3. ORM & Migrations

- **Decision**: Drizzle ORM (`mysql2`); `drizzle-kit generate` + `drizzle-kit migrate`
  with versioned SQL migrations in `drizzle/`.
- **Rationale**: Type-safe, code-first, versioned history for the deploy script.
- **Alternatives considered**: `drizzle-kit push` (no history), Prisma (not in stack).

## 4. Authentication, Organizations & Authorization

- **Decision**: Better Auth + `organization()` plugin (Drizzle adapter, MySQL), mounted
  at `app/api/auth/[...all]/route.ts`. Merchant = organization; roles `owner`
  (reseller) and `member` (sub-merchant) from the plugin's built-in roles. Platform
  admins are a separate `user.role = 'ADMIN'` claim and belong to no organization.
  Authorization enforced in every domain's `server/permissions.ts`: owner-scoped
  queries see all org devices; member-scoped queries see only devices where
  `device.memberId = member.id` (FR-025/027, SC-008). Org plugin tables
  (`organization`, `member`, `invitation`) added via `npx @better-auth/cli migrate`.
- **Rationale**: Constitution VII mandates Better Auth + RBAC; the user's clarified
  requirement is explicitly "integrate Better Auth's organization" — the plugin
  provides roles, invitations, and member management (add-member, invite, last-owner
  protection) so the reseller/sub-merchant hierarchy needs no custom auth code.
- **Alternatives considered**: flat merchant accounts (superseded by clarification),
  custom member model on `merchant_profile` (duplicates the plugin — rejected).

## 5. Device Organization Binding & Lifecycle

- **Decision**: Admin creates a device and assigns it to a reseller organization at
  creation/sale time; `device.organizationId` is set then and never cleared except by
  an admin reset (FR-026/028). `device.memberId?` is an optional per-device member
  assignment set when a reseller sells/assigns a device to a sub-merchant or a
  sub-merchant registers the device to their org account (FR-027).
- **Claim code**: a long-lived per-device secret (salted hash only), printed on the
  physical packaging. It authenticates both the accountless setup and the dashboard
  claim/registration (FR-004/005/023/024). It is NOT consumed by setup; it rotates
  (generates a fresh unguessable code) on every reset (FR-028). "Already-claimed"
  (Edge Cases) means a user account is already bound — subsequent account binding with
  that code is rejected.
- **State transitions**: UNCLAIMED → CLAIMED → PUBLISHED ↔ UNPUBLISHED; DISABLED;
  owner reset (keep `organizationId`, clear destinations + member assignment) and admin
  reset (clear everything back to unclaimed) both rotate the claim code.
- **Rationale**: Matches the clarified flows: accountless setup keyed on slug+code, org
  known before any merchant claims so sub-merchant registration routes into the right
  organization, and reset semantics distinguish owner (keeps org) from admin (clears org).
- **Alternatives considered**: org learned at first claim (breaks sub-merchant routing —
  rejected), single-use claim code (breaks "register later with same code" — rejected).

## 6. Data Fetching (SSR Prefetch + Hydration)

- **Decision**: Server Components prefetch TanStack Query and render
  `<HydrationBoundary>`; client components consume via `useSuspenseQuery`. Every data
  page has a skeleton loading state (Next.js `loading.tsx` or a per-component client
  Suspense boundary).
- **Rationale**: Canonical TanStack pattern + rules 5–8; satisfied SC-009 skeleton
  requirement.
- **Alternatives considered**: SWR, direct fetch, pure client fetch (all rejected).

## 7. Public Scan Resolution (redirect vs. landing)

- **Decision**: `GET /s/[slug]` serves both cases (one physical URL encodes slug):
  single-link → record scan then server-side `redirect()` (3xx, no client hop); multi-link
  → prefetch + server-rendered landing page; inactive → 200 inactive message;
  unknown slug → 404.
- **Rationale**: Route handlers and page cannot both serve GET on the same path; server-side
  redirect avoids a client hop; recording happens exactly once per request server-side
  (avoids StrictMode double-logging).
- **Alternatives considered**: separate redirect route handler (two URLs on one tag —
  impossible), client-side `window.location` redirect (flash, slower).

## 8. Accountless Setup & Redirect Flow

- **Decision**: Public `/{slug}/setup` (claim-code entry) then `/{slug}/setup/redirect`
  (destination type: single via Google Places search, or multi via Google Places +
  custom URLs), both server components in the `(redirect)` route group with NO theme
  provider (FR-034). Setup mutates only the device row (status CLAIMED, destinations);
  it never requires a user session. The same claim code later lets the merchant bind an
  account (register → join device's org as member; login → attach device to that
  account; FR-001/005/024).
- **Rationale**: Spec FR-004 + SC-002; stores no account state, keeps setup under two
  minutes.
- **Alternatives considered**: requiring account first (explicitly rejected by the user),
  handling setup inside the authenticated dashboard (breaks packaged-device UX).

## 9. Google Review Integration

- **Decision**: Google Places adapter in `domains/destination/server/`; merchant selects a
  place; system stores Google `place_id` and derives the review URL server-side
  (`https://search.google.com/local/writereview?placeid=<PLACE_ID>`). API key never
  reaches the browser.
- **Rationale**: Isolates the external dependency; derived URL needs no per-scan API call.
- **Alternatives considered**: client-side Places autocomplete (leaks key — rejected).

## 10. Analytics Sources

- **Decision**: Browser/device and referrer parsed server-side at scan time; country/city
  best-effort from IP geolocation; stored on the scan row; analytics domain aggregates
  totals/daily/per-device for the **owner** only (sub-merchants denied — SC-008).
- **Rationale**: FR-013/014/015; no client top-up on the redirect path.
- **Alternatives considered**: client reporting beacon (extra hop, blockable), paid geo.

## 11. Deployment & CI

- **Decision**: GitHub Actions `ci.yml` (node 22, `npm ci`, lint, typecheck, Vitest +
  coverage ≥90%, build) on push/PR; deployment via `scripts/deploy.sh` (SSH →
  git fetch/reset, `npm i`, `npm run db:migrate`, `build`, `pm2 restart nfc-platform`).
- **Hosting note**: canonical deploy script requires an SSH host running Node.js 22 + pm2 —
  a Hostinger VPS. Classic shared hosting cannot run a long-lived Node server; if truly
  constrained to shared hosting that is a separate deployment decision outside this plan.
- **Alternatives considered**: Docker deploy (unnecessary for MVP), cPanel (no CI story).

## 12. Observability

- **Decision**: Pino only; server middleware logs every request (id, method, path,
  status, durationMs, actor, device slug); errors re-logged with context.
- **Rationale**: Constitution VI.
- **Alternatives considered**: winston, console.log (rejected).

## 13. UI Stack & Theming

- **Decision**: shadcn/ui design system added via the CLI configured on **Base UI**
  (base-ui.com) primitives, used as the default for every standard primitive (buttons,
  forms, dialogs, toasts, sidebar, etc. — FR-029). Authenticated areas use the shadcn
  `sidebar` shell; auth screens (login/register) are a centered card on both axes
  (FR-030). Every action/mutation shows a toast on success and error (FR-031). Visual
  language is minimalist-enterprise with sky blue (`sky` scale) as the primary (FR-032).
  Light/dark theme served by **next-themes**, provider mounted in `(auth)` and
  `(merchant)` layouts only — never root, never `(redirect)` (FR-034). Skeleton loading
  on every data page uses **phantom-ui** (`@aejkatappaja/phantom-ui`), a structure-aware
  skeleton Web Component enabled client-side that wraps the real component in
  `<phantom-ui loading>` and measures the DOM; `npx @aejkatappaja/phantom-ui init`
  adds its SSR pre-hydration CSS + JSX types (FR-033, SC-009).
- **Rationale**: All are explicit user mandates (Clarification, Session 2026-09-14);
  Base UI is the requested primitive for shadcn; phantom-ui removes hand-maintained
  skeleton variants by deriving shimmer from the real DOM; next-themes scoping avoids
  theme flash/blocking on the fast public redirect route.
- **Alternatives considered**: Radix-primitive shadcn (rejected — user chose Base UI),
  shadcn `skeleton` component (rejected — user confirmed phantom-ui), hand-rolled
  themes (rejected).

## 14. Testing Framework

- **Decision**: Vitest for unit/component tests (React Testing Library, MSW), Playwright
  for e2e, 90% coverage gate (c8/V8 provider).
- **Rationale**: Direct-instruction deviation from constitution V recorded in the
  Clarifications (Session 2026-09-13): "Vitest — bun and the Node.js Test Runner are
  not used in this project". All other V. requirements unchanged.
- **Alternatives considered**: node:test (constitution default, superseded by the
  recorded direct instruction).