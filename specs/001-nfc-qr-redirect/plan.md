# Implementation Plan: NFC QR Redirect Platform

**Branch**: `001-nfc-qr-redirect` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-nfc-qr-redirect/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

**Canonical architecture**: `docs/architecture/NFC_PLATFORM_ARCHITECTURE_v3.md` (referenced in the command input as `docs/architecture/ARCHITECTURE.md`; the actual file is `NFC_PLATFORM_ARCHITECTURE_v3.md`). All rules in it are binding.

## Summary

The MVP is a fullstack redirect SaaS: a Next.js 16 App Router monolith where an admin
creates physical NFC/QR devices with unique identities and long-lived claim codes and
assigns each device to a reseller organization at sale time. A merchant can set up a
device **without any account** by opening/scaning/tapping the device URL
(`/{slug}/setup` → claim code → `/{slug}/setup/redirect` → destination type), or a
logged-in reseller/sub-merchant can claim and configure it from the dashboard. Merchants
are Better Auth **organizations**: the `owner` (reseller) sees device management,
analytics, and sub-merchant management; `member` (sub-merchant) sees only device
management for devices assigned to them. A public scan of a device either 302-redirects
to a single destination or shows a multi-link landing page — every scan recorded before
the customer proceeds and surfaced in the owner's analytics.

Technical approach: Domain-Based Modular Monolith on Next.js 16.3.5 (Node.js runtime),
six capability domains under `domains/`, `app/` strictly for routing and composition,
Drizzle ORM + MySQL, Better Auth + organization plugin + RBAC, TanStack Query SSR
prefetch + HydrationBoundary, TanStack Form + Zod, shadcn/ui via the CLI (Base UI
primitives) with sidebar shells, centered auth screens, toasts on every action,
phantom-ui (`@aejkatappaja/phantom-ui`) structure-aware skeletons, next-themes (login +
dashboard only), sky-blue enterprise theme, Vitest + Playwright at ≥90% coverage,
GitHub Actions CI, and an SSH (pm2) deploy script for Hostinger (VPS).

**UI design directive**: The dashboard and auth screens are rebuilt to match the
`khitan-plus-hipnosis` reference project (Clarifications, Sessions 2026-09-14/15): shadcn
`sidebar` shell with sidebar variant inset, brand header, nav groups (`NavMain`),
user dropdown footer (`NavUser`), breadcrumb header with theme toggle; auth screens are a
centered card on a sky-blue gradient background with framer-motion staggered entrance
animations (login/register only — never dashboard). **All roles use root-level paths with
no role prefixes and no nested route groups** (FR-036): **admin** → Dashboard / Devices /
User management / Merchants / Settings; **reseller (owner)** → Dashboard / Devices / User
management / Settings; **sub-merchant (member)** → Dashboard / Devices / Settings.
Sidebar and endpoint access are resolved from the normalized permission model
(`master_role` + `permission` + `role_permission`, FR-037). Navigation is fetched on the
client via `GET /api/permissions` with a phantom-ui skeleton; `layout.tsx` never fetches
nav server-side (FR-043). `ADMIN` bypasses all guard-level checks (FR-041) but its
permission links are still seeded so the sidebar/self-list render everything from real
rows. Analytics renders inside the Dashboard (owner role) as a date-filterable view, and
the admin `/dashboard` shows a cross-merchant aggregate with a date-range picker (FR-044).

**UI directives (Session 2026-09-17)**: `/dashboard` renders NO navigation card — only
analytical data and charts (scan-per-day and scan-per-device as charts, not lists) on
both owner and admin dashboards (FR-048); the admin dashboard additionally shows
total-merchant and total-user summary metrics (FR-051). Every data table (device
inventory, user management, merchants) has a frozen right-side Actions column with an
EllipsisVertical dropdown (device: Edit/Delete/Reset; user management & merchants:
Edit/Delete) opening dialogs (FR-045); the device row "Edit" MUST open an in-place
dialog — never `route.push` to `/devices/[id]` (FR-040). On the user-management and
merchants views, filtering/searching is **server-driven**: a merchant (organization)
combobox plus search on user-management and a search box on merchants each re-fetch
from the server with debounced query params (`q`, `organizationId`, `page`, `limit`);
the combobox option list loads via infinite TanStack Query (`useInfiniteQuery`), never
`prefetchQuery`; no client-side filtering of an already-loaded list (FR-046/055/056).
Status/role indicators use the shadcn `badge` component with built-in variants only
(FR-050); device slugs show a copy button that copies `{{BASE_URL}}/s/:id` with a toast
(FR-049); user-facing copy says "merchants" not "organization" (FR-047). Admin gets full
CRUD for user accounts (create name/email/password + org + role; edit name/email/role/
org/devices including moving a user from one org to another; delete deactivates the
account) via dialogs (FR-052/053) and for merchant organizations (create org shell with
business name only, owner assigned later; edit name + owner; delete) via dialogs
(FR-054). Destructive session-management actions on Settings — revoke a session or
"Revoke all others" — MUST be preceded by a shadcn `AlertDialog` confirmation (FR-039).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) on Node.js 22 LTS runtime,
Next.js 16.3.5 (App Router, `export const runtime = 'nodejs'` on route handlers/segments).

**Primary Dependencies**:

- Next.js 16 (App Router) — fullstack server components + route handlers
- Drizzle ORM (mysql2 driver) + drizzle-kit (generate/migrate workflow)
- Better Auth (Drizzle adapter, MySQL) + `@better-auth/drizzle-adapter`,
  `organization()` plugin + `organizationClient()` (org = merchant, roles `owner`+`member`)
- TanStack Query v5 — SSR prefetch + HydrationBoundary + useSuspenseQuery; **server-driven
  lazy lists** use debounced `useQuery` with `page`/`limit`/`q`/`organizationId` params and the
  merchant combobox uses **`useInfiniteQuery`** (option pages stream on type/scroll — never
  `prefetchQuery` for the option list) (FR-055/056)
- TanStack Form + Zod — type-safe forms validated at every input boundary
- shadcn/ui (design system, added via CLI, **Base UI** primitives) + `sidebar` shell
- phantom-ui (`@aejkatappaja/phantom-ui`) — structure-aware skeleton loading (loading.tsx / Suspense)
- next-themes — light/dark theme provider (login + dashboard only)
- framer-motion — staggered entrance animations on login/register screens only (never dashboard)
- Pino — sole logging library (server-side structured logs)

**Testing**: Vitest (unit/component, via direct instruction deviation from
constitution V) + React Testing Library + MSW (API mocking) + Playwright (e2e) + c8/V8
coverage; minimum 90% overall coverage; ran in CI.

**Storage**: MySQL 8.x single database; Drizzle schema in `db/`, versioned SQL
migrations generated by drizzle-kit into `drizzle/`, seed script in `db/seed.ts`.
Better Auth organization plugin contributes `organization`, `member`, `invitation`
tables (via `npx @better-auth/cli migrate`). A project-owned normalized permission model
is seeded by default (FR-036/037): `master_role` (platform roles ADMIN/MERCHANT),
`permission` (nav + API-endpoint rows: `path`, `label`, `icon`, `is_menu`,
`parent_id`, `sort` — NO role column), and `role_permission` (join `id`, `role_id`,
`permission_id`, optional `scope` of `owner` | `member` | both). Role-based list APIs:
`GET /api/permissions` (self) and `GET /api/roles/:roleId/permissions` (admin, FR-042).

**Target Platform**: Web application; mobile-first; deployed to Hostinger (VPS, SSH) via
`scripts/deploy.sh` under pm2 as `nfc-platform`. Public pages are SEO-friendly server
components.

**Project Type**: web-service (fullstack SaaS web application — no native apps).

**Performance Goals**: scan → destination under 2 seconds on a standard mobile
connection (SC-001); accountless setup completes under 2 minutes (SC-002); landing and
app pages render without visible blocking on mobile; redirect path avoids any
client-side hop.

**Constraints**: WCAG AA; every request produces a structured Pino log; no
component/hook calls `fetch()` directly (all via domain API); every page prefetches
TanStack Query; page/layout/server-component conventions per architecture rules 1–9;
Zod validation at every input boundary; secrets only via environment variables; ≥90%
coverage gate in CI; Biome lint+format gate in CI; shadcn used wherever a standard
primitive exists; every action shows a toast; every data page shows a phantom-ui
skeleton; next-themes never wraps the public redirect route.

**Scale/Scope**: MVP. Likely merchants (organizations) in the hundreds, devices in the
low thousands, scan volume event-driven (bursts on physical placement); single MySQL
instance with per-device and daily aggregation queries. No billing, no native apps, no
multi-region hosting. Purchases/claim-code distribution are offline (Assumptions in
spec).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Architecture First** — PASS. Business capabilities map to exactly one domain each
  (`domains/{auth,merchant,device,destination,scan,analytics}`); `app/` holds routing and
  composition only; business logic lives in `domains/*/server/` never in `page.tsx`/`layout.tsx`.
- **II. Frontend Principles** — PASS. Every `page.tsx` is a Server Component; layouts are
  synchronous and fetch nothing; every page prefetches TanStack Query and hydrates via
  `HydrationBoundary`; client components read data only through `useSuspenseQuery`
  (architecture rule 6). Public landing/redirect pages are server-rendered; single-link
  scan path redirects server-side before response. Skeletons use `loading.tsx`/Suspense.
  **Exception**: framer-motion animations on `(auth)` login/register pages are client-only
  loading interactions; dashboard pages rely on phantom-ui skeleton loading (SC-009).
- **III. API Principles** — PASS. Networking only through `domains/*/api/client.ts +
  queries + mutations`; no `fetch()` in components or hooks; the only route handlers
  (`app/api/auth/[...all]/route.ts`, Google Places adapter, public scan resolution)
  translate HTTP into domain services.
- **IV. Quality Standards** — PASS. Every feature includes unit tests, ≥90% coverage,
  Playwright e2e for critical flows (accountless setup → scan, org claim → scan → analytics),
  error/loading/empty states (architecture rule 7–8; spec FR series).
- **V. Testing Requirements** — PASS with one documented deviation: Vitest replaces the
  Node.js Test Runner by direct instruction (Clarification, Session 2026-09-13), all else
  (RTL, Playwright, MSW, 90% threshold) unchanged.
- **VI. Observability** — PASS. Pino only; every request logged with structured context
  (request id, method, path, status, durationMs, actor, device); errors logged with context.
- **VII. Security** — PASS. Better Auth (mandated) + organization plugin; authorization via
  org roles (`owner`/`member`) enforced in `domains/*/server/permissions.ts` and the
  normalized `master_role`/`permission`/`role_permission` model with ADMIN superuser
  bypass (FR-037/041); claim codes stored hashed and rotated on reset; secrets via env
  only; Zod validation at every input boundary.
- **VIII. Code Quality** — PASS. TypeScript strict, Biome for lint+format, CI must pass
  before merge.
- **IX. Scalability** — PASS. Each domain exposes a thin API layer and route handlers;
  any domain can later be extracted into its own Next.js route-service or backend service
  without touching the frontend, because UI consumes only the domain API.

No gate violations. No complexity justification required.

**Post-Phase-1 re-check**: The regenerated `data-model.md` relies on Better Auth's
organization plugin tables (`organization`, `member`, `invitation`) plus extended
`device` fields (`organizationId`, `memberId`, `boundUserId`, rotated `claimCodeHash`)
and the project-owned normalized permission model (`master_role`, `permission`,
`role_permission`).
No constitution violation is introduced: RBAC enforcement remains in
`domains/*/server/permissions.ts`, now backed by the seeded normalized model queried via
`can(role, orgRole, path)` with ADMIN guard bypass (VII); nav is served client-side via
`GET /api/permissions` so `(dashboard)/layout.tsx` stays synchronous/fetch-free (II);
claim-code secrets are stored hashed and rotated on reset (VII); device FKs are
DB-enforced; no business logic moved into `app/` (I); the `(dashboard)` route group with
root paths and permission-driven nav is pure routing/composition, and each page prefetches
data via TanStack Query (II); the accountless setup and scan routes are server components
with `loading.tsx`/Suspense skeletons (II/IV); framer-motion is a client-only animation
for auth screens with no data fetching, so it complies with II and needs no loading-state
exemption. Chart rendering (shadcn `chart`/recharts, FR-048/051) is client-side inside
`(dashboard)` components that consume analytics via `useSuspenseQuery` from the domain API
(III) — data flows through TanStack Query, never fetched in components, so no new
constitution violation. Admin user/merchant CRUD (FR-052/053/054) lands in
`domains/merchant/server/*-actions.ts` + the two new server-driven list route handlers
(`/api/members`, `/api/organizations`) — business logic stays in the domain, `app/` only
wires routes/composition (I); list consumers use `useQuery`/`useInfiniteQuery` from the
domain API layer, not `fetch()` (III); create/delete dialogs and the `AlertDialog`
session-revoke flow are client-only `Dialog`/`AlertDialog` components with no data
fetching (II). Gate status after Phase 1: all PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-nfc-qr-redirect/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── domain-api.md
│   ├── public-scan.md
│   └── setup-claim.md   # accountless setup + org binding contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/                                # routing + composition only (no business logic)
├── layout.tsx                      # root; NO next-themes here (theme is scoped below)
├── providers.tsx
├── error.tsx
├── not-found.tsx
├── (auth)/                         # login + register (centered card, next-themes, framer-motion)
│   ├── layout.tsx                  # sync, no fetch
│   ├── login/page.tsx              # /login — motion entrance, sky-blue gradient card
│   ├── register/page.tsx           # /register — motion entrance, sky-blue gradient card
│   ├── register-claim/page.tsx     # /register-claim — claim-code account creation (FR-024)
│   └── loading.tsx
├── (landing-page)/                 # public marketing homepage + branding (next-themes)
│   ├── layout.tsx                  # sync, no fetch; next-themes provider
│   ├── page.tsx                    # / — marketing homepage, SEO-ready (robots, sitemap)
│   ├── robots.ts                   # robots directives for public pages
│   └── sitemap.ts                  # sitemap for public pages
├── (dashboard)/                    # authenticated area — SHARED root paths for ALL roles
│   ├── layout.tsx                  # auth guard + sidebar shell + next-themes; sync, no fetch, no nav data
│   ├── loading.tsx
│   ├── error.tsx
│   ├── dashboard/page.tsx          # /dashboard — role-aware; owner analytics (date-filtered) + admin aggregate (FR-044/051); scan-per-day & scan-per-device charts (FR-048)
│   ├── devices/
│   │   ├── page.tsx                # /devices — admin: all; owner: org; member: assigned (FR-025/027)
│   │   ├── new/page.tsx            # /devices/new — admin only; create + assign org (FR-026)
│   │   ├── claim/page.tsx          # /devices/claim — claim code → login-or-register (FR-005)
│   │   └── [id]/
│   │       ├── page.tsx            # /devices/[id] — configure destinations / publish; reached via detail/claim, NEVER via row Edit (FR-040)
│   │       └── settings/page.tsx   # /devices/[id]/settings — assign member, reset, unpublish
│   ├── user-management/page.tsx    # /user-management — admin + reseller owner (member list + Edit/Delete; admin: toolbar Add user; NO invite — FR-022/045/052). Admin list is server-driven (debounced search + merchant combobox via useInfiniteQuery, no prefetchQuery — FR-055/056); edit dialog supports moving a user to another merchant org (FR-053)
│   ├── merchants/page.tsx          # /merchants — admin only; org list (FR-018) with server-driven debounced search + toolbar Add merchant; create/edit/delete merchant dialogs (FR-054/055)
│   └── settings/page.tsx           # /settings — all roles (profile, org, theme)
├── (redirect)/                     # public device URL space (NO theme provider)
│   ├── s/[slug]/                   # public scan resolution
│   │   ├── page.tsx                # single: record + redirect(); multi: landing
│   │   └── loading.tsx
│   └── [slug]/setup/               # accountless setup (FR-004)
│       ├── page.tsx                # claim-code entry
│       ├── redirect/page.tsx       # single (Google Places) or multi (Places + URL)
│       └── loading.tsx
└── api/                            # route handlers (translation only)
    ├── auth/[...all]/route.ts      # Better Auth route handler
    ├── permissions/route.ts        # GET /api/permissions — caller's permitted nav + API paths (FR-042)
    ├── roles/[roleId]/permissions/route.ts  # GET /api/roles/:roleId/permissions — admin-only (FR-042)
    ├── analytics/overview/route.ts # GET /api/analytics/overview?from&to (FR-044)
    ├── analytics/admin-overview/route.ts   # GET /api/analytics/admin-overview?from&to — admin cross-merchant incl. merchant/user counts (FR-044/051)
    ├── members/route.ts            # GET /api/members?q&organizationId&page&limit — admin server-driven user list (FR-052/055)
    ├── members/[memberId]/route.ts # admin member CRUD actions (edit incl. move-org, delete/deactivate) — FR-052/053
    ├── organizations/route.ts      # GET /api/organizations?q&page&limit — admin server-driven merchant list (FR-054/055)
    └── ...                         # thin per-domain HTTP translations
```

```text
components/                         # shared UI: shadcn/ui (Base UI primitives)
├── common/                         # toasts, centered-auth wrapper, skeletons
├── ui/                             # shadcn-generated components (cli: shadcn add ...)
│   ├── table.tsx                   # shadcn table primitives
│   ├── badge.tsx                   # shadcn badge — ALL status/role pills use built-in variants only (FR-050)
│   ├── chart.tsx                   # shadcn chart (recharts) — scan-per-day & scan-per-device render as charts (FR-048), admin summary charts (FR-051)
│   ├── calendar.tsx / popover.tsx  # shadcn primitives for the date-range picker (shadcn add calendar popover)
│   ├── date-range-picker.tsx       # presets + 2-month range calendar + reset/apply; from reference date-range-picker.tsx (FR-044)
│   └── data-table/                 # reusable DataTable on @tanstack/react-table: data-table.tsx, -header, -pagination, -skeleton, -view-options (FR-038)
├── layout/                         # reference-matched shell (see below)
│   ├── app-sidebar.tsx             # shadcn Sidebar (variant inset): brand header + NavMain + NavUser
│   ├── nav-main.tsx                # nav menu fetched client-side via GET /api/permissions, phantom-ui skeleton while loading (is_menu=true)
│   ├── nav-user.tsx                # footer user dropdown (account, sign out)
│   ├── nav-link.tsx                # active-state nav item
│   ├── dashboard-breadcrumb.tsx    # path-based breadcrumb in the header
│   ├── theme-toggle.tsx            # light/dark toggle
│   └── app-header.tsx              # SidebarTrigger | Separator | Breadcrumb | ThemeToggle
└── sections/auth/                  # sign-in/register forms (framer-motion, sky-blue gradient)
providers/
├── query-client.tsx                # QueryClientProvider
├── auth.tsx                        # Better Auth session provider
└── theme.tsx                       # next-themes ThemeProvider ((auth) + (dashboard) + (landing-page) layouts only)
hooks/                              # shared hooks (auth session, active org, toasts)
lib/                                # pino logger, query-client, auth server singleton, phantom-ui setup
db/                                 # Drizzle ORM
├── schema/
│   ├── auth.ts                     # Better Auth core + organization/member/invitation
│   ├── merchant.ts                 # organization extension fields + profile gaps
│   ├── device.ts                   # device + organizationId + memberId + claimCodeHash
│   ├── destination.ts              # destinations + place
│   ├── scan.ts                     # scan_event
│   ├── permission.ts               # normalized model: master_role + permission (path,label,icon,is_menu,parent_id,sort) + role_permission (role_id,permission_id,scope) (FR-037)
│   └── analytics.ts                # aggregated views (optional in MVP)
├── relations.ts
├── index.ts
└── seed.ts                         # ADMIN, reseller org + owner, member, devices, master_role/permission/role_permission rows
drizzle/                            # drizzle-kit generated migrations (sql + meta)
domains/
├── auth/                           # Better Auth + organization plugin config, RBAC
│   └── server/permissions.ts       # can(role,orgRole,path) from master_role/permission/role_permission; ADMIN bypass; listNavForRole-equivalent self-list behind GET /api/permissions
├── merchant/                       # org lifecycle, member management (claim-code join, NO invite), device assign
├── device/                         # identity, claim codes, setup, lifecycle (publish/disable/reset/rotate)
├── destination/                    # single/multi-link config, Google review via Places
├── scan/                           # resolution: redirect + landing, scan event recording
└── analytics/                      # owner metrics aggregation (overview(from?,to?)) + admin cross-merchant aggregate (adminOverview(from?,to?) incl. merchant/user counts) (FR-044/051)
scripts/                            # deploy.sh (SSH/pm2), db helpers
tests/                              # e2e (Playwright) + MSW handlers + fixtures
.github/workflows/                  # ci.yml (push/PR), deploy.yml (optional manual)
package.json
next.config.ts
tsconfig.json
drizzle.config.ts
biome.json
.env.example
```

Each domain follows the architecture template:
`domains/<name>/{api/{client,queries,mutations}, server/{service,repository,mapper,permissions}, components, schemas, types, constants, utils, index, __tests__}`

**Structure Decision**: Single-project web application following the canonical
`NFC_PLATFORM_ARCHITECTURE_v3.md` directory tree verbatim. The org/hierarchy and the
accountless-setup/redirect entry points are new capabilities folded into the existing
six domains (`merchant` gains org/member management; `device` gains setup + claim-code
rotation). **The authenticated area is one shared `(dashboard)` route group with root-level
paths for every role (admin, reseller, sub-merchant) — no role URL prefixes, no nested
role groups (FR-036).** Access and nav are driven by the normalized permission model
(`master_role`/`permission`/`role_permission`): nav is fetched client-side via
`GET /api/permissions` in the sidebar with a phantom-ui skeleton (FR-043), `layout.tsx`
stays synchronous and fetch-free; proxy.ts checks `can(role, orgRole, path)` for denied
routes with ADMIN guard bypass (FR-041). Route groups are exactly four: `(auth)`,
`(dashboard)`, `(landing-page)`, `(redirect)`.
Public device surface lives in the `(redirect)` route group: `/s/[slug]` (scan) and
`/[slug]/setup` + `/[slug]/setup/redirect` (accountless setup). The theme provider
(next-themes) is mounted in the `(auth)` and `(dashboard)` layouts (and the public
`(landing-page)` layout) — never in the root
layout or the `(redirect)` group (FR-034). Auth screens carry framer-motion staggered
entrance animations on a sky-blue gradient card; the dashboard header is
`SidebarTrigger | Separator | Breadcrumb | ThemeToggle` and the sidebar mirrors the
`khitan-plus-hipnosis` reference (app-sidebar, nav-main, nav-user).