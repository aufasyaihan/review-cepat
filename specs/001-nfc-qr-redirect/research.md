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
  Authorization is enforced through the normalized `master_role`/`permission`/
  `role_permission` model in every domain's `server/permissions.ts`; `ADMIN` bypasses
  all guard checks (FR-041); MERCHANT resolves its active org role (`owner`/`member`)
  so scoped `role_permission` links gate owner-only vs member-only capability (FR-037).
  Owner-scoped queries see all org devices; member-scoped queries see only devices
  where `device.memberId = member.id` (FR-025/027, SC-008). Org plugin tables
  (`organization`, `member`, `invitation`) added via `npx @better-auth/cli migrate`.
- **Rationale**: Constitution VII mandates Better Auth + RBAC; the user's clarified
  requirement is explicitly "integrate Better Auth's organization" — the plugin
  provides roles, invitations, and member management so the reseller/sub-merchant
  hierarchy needs no custom auth code. **Note (Session 2026-09-17, FR-022/052)**: the
  user-management UI MUST NOT expose an invite or self-service add-member flow;
  sub-merchants join an organization by self-registering via a device claim code
  (FR-024) OR when an admin provisions the account directly (FR-052; no email
  invitation). The plugin's `invitation` table still exists (ships with the plugin) but
  is unused by the MVP UI. Admin can also move a user from one organization to another
  via the edit-user dialog (FR-053).
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
  totals/daily/per-device for the **owner** only (sub-merchants denied — SC-008), with
  optional `from`/`to` date parameters; a separate **admin cross-merchant aggregate**
  (`adminOverview(from?, to?)`) powers the admin `/dashboard` analytics with the
  date-range picker (FR-044).
- **Rationale**: FR-013/014/015; no client top-up on the redirect path; date filtering
  stays in SQL so presets/custom ranges return only scans in the selected window.
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

## 13. UI Stack, Theming & Layout

- **Decision**: shadcn/ui design system added via the CLI configured on **Base UI**
  (base-ui.com) primitives, used as the default for every standard primitive (buttons,
  forms, dialogs, toasts, sidebar, etc. — FR-029). Authenticated areas use the shadcn
  `sidebar` shell; auth screens (login/register) are a centered card on both axes
  (FR-030). Every action/mutation shows a toast on success and error (FR-031). Visual
  language is minimalist-enterprise with sky blue (`sky` scale) as the primary (FR-032).
  Light/dark theme served by **next-themes**, provider mounted in `(auth)`, `(landing-page)`, and `(dashboard)`
  layouts only — never root, never `(redirect)` (FR-034). Skeleton loading
  on every data page uses **phantom-ui** (`@aejkatappaja/phantom-ui`), a structure-aware
  skeleton Web Component enabled client-side that wraps the real component in
  `<phantom-ui loading>` and measures the DOM; `npx @aejkatappaja/phantom-ui init`
  adds its SSR pre-hydration CSS + JSX types (FR-033, SC-009). **Login and register
  pages** use **framer-motion** for staggered entrance animations — card fade-in, form
  field slide-up with delay stagger, and button entrance — on a sky-blue gradient
  background (`from-white via-sky-50/40 to-blue-50/60` light / `from-neutral-950
  via-sky-950/10 to-blue-950/20` dark) with sky-tinted radial overlays; framer-motion is
  NOT used on any dashboard page (FR-035). The authenticated header is
  `SidebarTrigger | Separator | Breadcrumb | ThemeToggle` matching the reference project.
- **Rationale**: All are explicit user mandates (Clarification, Session 2026-09-15);
  Base UI is the requested primitive for shadcn; phantom-ui removes hand-maintained
  skeleton variants by deriving shimmer from the real DOM; next-themes scoping avoids
  theme flash/blocking on the fast public redirect route; framer-motion provides polished
  auth-screen transitions without JS overhead on data-heavy dashboard pages.
- **Alternatives considered**: Radix-primitive shadcn (rejected — user chose Base UI),
  shadcn `skeleton` component (rejected — user confirmed phantom-ui), hand-rolled
  themes (rejected), framer-motion everywhere (rejected — skeleton loading on dashboard
  pages preferred).

## 14. Permission-Driven Navigation & Endpoint Access

- **Decision**: All roles (admin, reseller/owner, sub-merchant/member) share root-level
  paths — no role-specific URL prefixes, no nested route groups. Access and sidebar
  navigation are driven by a **normalized permission model** (Clarification
  2026-09-16, FR-037): three tables — `master_role` (platform roles `ADMIN` and
  `MERCHANT` only), `permission` (one row per nav/endpoint item: `path`, `label`,
  `icon`, `is_menu`, `parent_id`, `sort`; NO role column), and `role_permission`
  (join: `id`, `role_id`, `permission_id`, optional `scope` of `owner` | `member` |
  `both` — so a single MERCHANT role row grants org-scoped permissions via scoped
  links, replacing the legacy `MERCHANT:owner`/`MERCHANT:member` tokens and the
  `permission.roles` JSON column). The model is seeded by default with the correct
  links per role (admin → Dashboard/Devices/User management/Merchants/Settings;
  reseller/owner → Dashboard/Devices/User management/Settings;
  sub-merchant/member → Dashboard/Devices/Settings).
- **ADMIN superuser**: `can()`, `requireApiPermission()`, and page guards return
  allowed for an ADMIN user without any permission-table lookup (FR-041). ADMIN→
  permission links are still seeded so the sidebar and `GET /api/permissions` render
  every item for ADMIN from real rows — no special-casing in nav rendering.
- **Client-side nav (FR-043)**: navigation data is fetched on the client via the
  authenticated `GET /api/permissions` endpoint (FR-042); the sidebar renders a
  phantom-ui skeleton while nav loads. `location/layout.tsx` MUST NOT be a dynamic
  route or fetch navigation data server-side.
- **Two list APIs** (FR-042): (1) authenticated `GET /api/permissions` — caller's own
  permitted nav + API paths (drives sidebar and client gating, replaces the
  server-side `listNavForRole`); (2) admin-only `GET /api/roles/:roleId/permissions` —
  a role's permission mapping for permission administration and seed verification.
  The `(dashboard)` group layout stays server-rendered but reads no nav data itself;
  the proxy/layout calls `can(role, orgRole, path)` to reject access before rendering
  the page (FR-036), with ADMIN bypass.
- **Rationale**: User-direct mandate: "navigation and endpoint will be seeded by default",
  then "create list api that can be accessed by each roles in database", normalized
  into `master_role` + `role_permission` + `permission`, and "admin should never have a
  permission check", plus "layout.tsx should never be a dynamic route — fetch nav data on
  the client side with phantom-ui skeleton". Centralised nav eliminates duplicated
  hardcoded NAV arrays; adding an endpoint is a seed link, not a code change; permission
  enforcement at the proxy/guard level catches direct URL navigation, not just sidebar
  clicks; ADMIN bypass fixes the actual defect where admin was denied merchant-only
  endpoints (e.g. `/api/device/claim`).
- **Alternatives considered**: hardcoded per-role NAV arrays (rejected — user mandated
  seeded table), nested route groups with role prefixes (rejected — root paths only),
  role-variant rows in `master_role` (option A — rejected for B: single MERCHANT row +
  `scope` column), server-rendered nav in layout (rejected — FR-043 client-side fetch).

## 15. Admin Dashboard Analytics & Date Filtering

- **Decision**: The admin `/dashboard` renders analytical data aggregated across ALL
  merchants' devices, filterable by a **date-range picker** (FR-044). The component is
  ported from the reference project (`khitan-plus-hipnosis/components/ui/date-range-picker.tsx`):
  a popover with preset ranges (today, yesterday, last 7/14/30 days, this month, last
  month, this year) and a 2-month range calendar with reset/apply controls, driving an
  analytics API that accepts `from`/`to` date query params. The existing owner
  `overview()` gains optional `from`/`to`; a new `adminOverview(from?, to?)` aggregates
  across organizations. Empty windows return zero-filled data; invalid ranges
  (`from` > `to`, open-ended) are rejected (Edge Cases, Session 2026-09-16).
- **Rationale**: User-direct mandate: "on the admin dashboard /dashboard should be
  analytical data, create date-picker for filtering". Reusing the reference picker keeps
  the preset/locale/UX identical; passing `from`/`to` to the service keeps filtering in
  SQL rather than client-side.
- **Update (Session 2026-09-17, FR-048)**: the `/dashboard` page renders NO navigation
  card; it shows analytical data plus a chart/graph (scan volume over time) alongside
  the summary, all respecting the active date range.
- **Update (Session 2026-09-17, FR-051)**: "Scan per day" and "scan per device"
  breakdowns render as **charts, not lists**, on both owner and admin dashboards; the
  admin dashboard additionally shows **total-merchant** (org count) and **total-user**
  (platform account count) summary metrics via `adminOverview`. Charting uses shadcn
  `chart` (recharts).
- **Alternatives considered**: client-side filtering of a full dump (rejected — unscalable),
  date inputs without presets (rejected — mandated picker look), no admin aggregate
  (rejected — requirement is all-merchant analytics).

## 17. Data-Table Actions, Filters, and Copy-to-Clipboard

- **Decision**: Every dashboard data table (device inventory, user management,
  merchants) ships an **Actions column** — a lucide `EllipsisVertical` icon opening a
  dropdown — **frozen (pinned) to the right side** of the table (FR-045). Menu items:
  device → Edit / Delete / Reset; user management → Edit / Delete (admin added to
  toolbar: "Add user"); merchants → Edit / Delete (admin added to toolbar: "Add
  merchant"). Each item or toolbar action opens the corresponding dialog
  (FR-039/040). The device row **Edit MUST open an in-place dialog, never
  `route.push`** to `/devices/[id]` (FR-040). Wherever a device slug is shown, an
  adjacent copy button copies `{{BASE_URL}}/s/:id` with a success toast (FR-049).
- **Server-driven filtering (Session 2026-09-17, supersedes FR-046 for user-management
  & merchants)**: the user-management view filters by a merchant (organization)
  combobox plus a search box, and the merchants view has a search box; each re-fetches
  the list from the server with **debounced query params** (`q`, `organizationId`
  where applicable, `page`, `limit`) — no client-side filtering of an already-loaded
  list (FR-055). The merchant combobox **option list** loads via **TanStack Query
  `useInfiniteQuery`** — pages stream as the admin types (`q`) and scrolls — and MUST
  NOT use `prefetchQuery` for the option list (FR-056). The DataTable column filter
  remains for device inventory.
- **Admin CRUD dialogs (Session 2026-09-17, FR-052/053/054)**: user-management —
  Create (name/email/password + org + role), Edit (name, email, role, reassign org
  incl. move user between organizations, assign/disassign devices), Delete (remove
  membership + deactivate account); merchants — Create (org shell with business name
  only, no owner), Edit (business name, assign owner from existing accounts), Delete
  (removes org). All via dialogs with confirmation and toasts.
- **Session revoke confirmation (FR-039/SC-022)**: the Settings active-sessions
  "Revoke all others" (and revoke a session) actions are gated by a shadcn
  `AlertDialog` confirmation before executing.
- **Rationale**: User-direct mandates ("EllipsisVertical icon using dropdown… apply on
  user management and merchant… action column should be a frozen column", "use the data
  table header filter", "add copy button on the slug", device Edit "should open a dialog
  to edit it", "revoke button to have an alert dialog first"). Freezing the action
  column to the right keeps row actions reachable while data columns scroll; the
  user-management/merchant lists and their filter options are server-driven to stay
  correct and responsive as rows grow.
- **Alternatives considered**: inline row action buttons (rejected — crowded columns),
  left-pinned action column (rejected — right-pinned chosen), unfrozen action column
  (rejected — mandated frozen), client-side filtering (rejected — "do not filter client
  side"), `prefetchQuery` combobox options (rejected — user mandated infinite query).

## 19. Badge Rendering

- **Decision**: Every status/role pill (device status, membership role, any state
  badge) renders with the shadcn `badge` component (`npx shadcn@latest add badge`)
  using its built-in `variant` prop — `default`, `secondary`, `destructive`, `outline`
  (FR-050). No custom pill component, no hand-rolled variant classes.
- **Rationale**: User-direct mandate "change it to using badge instead, for the variant
  use badge variant not custom". Mapping device statuses to existing variants (`published`
  → default, `unpublished`/`unclaimed` → secondary, `disabled`/`deleted` → destructive,
  etc.) keeps theming consistent with the rest of the design system and removes
  bespoke styling.
- **Alternatives considered**: kebab/pill span components (rejected), per-status custom
  Tailwind classes (rejected — mandate is built-in variants only).

## 18. Terminology: merchants vs. organizations

- **Decision**: User-facing copy (labels, nav, headings, filters) says **"merchants"**
  / **"merchant"**; technical/domain identifiers keep Better Auth's **organization**,
  the `organizationId` field, and the org plugin (FR-047).
- **Rationale**: User-direct mandate "change the wording from organization to
  merchants". Renaming the domain model would fork the Better Auth plugin; scoping the
  change to presentation copy is the lazy correct fix.
- **Alternatives considered**: full domain rename (rejected — would fork the plugin).

## 16. Testing Framework

- **Decision**: Vitest for unit/component tests (React Testing Library, MSW), Playwright
  for e2e, 90% coverage gate (c8/V8 provider).
- **Rationale**: Direct-instruction deviation from constitution V recorded in the
  Clarifications (Session 2026-09-13): "Vitest — bun and the Node.js Test Runner are
  not used in this project". All other V. requirements unchanged.
- **Alternatives considered**: node:test (constitution default, superseded by the
  recorded direct instruction).