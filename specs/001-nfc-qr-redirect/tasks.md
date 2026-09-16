---

description: "Task list for the NFC QR Redirect platform UI rebuild + route restructure + permission normalization + admin analytics"
---

# Tasks: NFC QR Redirect Platform

**Input**: Design documents from `/specs/001-nfc-qr-redirect/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project (Next.js App Router): `app/`, `domains/`, `components/`, `db/`, `tests/` at repository root
- Route groups are exactly four: `(auth)`, `(dashboard)`, `(landing-page)`, `(redirect)` (FR-036)
- All roles share root-level paths inside `(dashboard)`; nav/access comes from the normalized `master_role`/`permission`/`role_permission` model, consumed client-side via `GET /api/permissions` (FR-037/042/043)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Close the gap between the current repo state and the plan's target foundation.

- [x] T001 Add `framer-motion` to `package.json` dependencies and run `npm i`
- [x] T003 [P] Delete legacy root-level empty route dirs `app/analytics`, `app/dashboard`, `app/devices`, `app/login`, `app/register` (their real pages live under route groups)
- [x] T004 Verify `next-themes` provider is NOT present in `app/layout.tsx` root (theme mounts only in `(auth)`, `(landing-page)`, `(dashboard)` layouts — FR-034)

> Legacy T002 (single `permission` table with `roles` JSON column) is SUPERSEDED by T054 — the normalized model replaces it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story — permission-driven nav/access, seed data, and the shared authenticated shell.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 (superseded by T054) Create `domains/auth/server/permissions.ts` with `can(role, orgRole, path)` + `listNavForRole(role, orgRole)` from the permission model (FR-036)
- [x] T006 (superseded by T055) Insert per-role permission seed rows in `db/seed.ts` + `db/seed/e2e.ts` (FR-037)
- [x] T007 [P] Next.js 16 `proxy.ts`: resolve Better Auth session; deny routes where `can(role, orgRole, path)` is false (redirect to `/dashboard`); redirect unauthenticated `(dashboard)` paths to `/login`; keep public `(redirect)` + `(landing-page)` open; run `npm run typecheck`. **Re-verified by T059 (ADMIN bypass).**
- [x] T008 (superseded by T058) Wire `listNavForRole` into the sidebar data source so `(dashboard)/layout.tsx` renders nav from permission rows; `accessDenied(...)` guard helper
- [x] T009 Create the shared `(dashboard)` authenticated shell: `app/(dashboard)/layout.tsx` (auth guard, shadcn `sidebar` reference layout — brand header, NavMain, NavUser, inset variant, `SidebarTrigger | Separator | Breadcrumb | ThemeToggle` header), `app/(dashboard)/loading.tsx` + `app/(dashboard)/error.tsx`
- [x] T010 [P] Move the themed sidebar shell out of the legacy `(admin)`/`(merchant)` layouts into the shared `(dashboard)` shell; delete `components/layout/app-shell.tsx`'s route-group assumptions and reuse it from `(dashboard)/layout.tsx` only

**Checkpoint**: Foundation ready — permission-driven nav works for all three roles under `(dashboard)` root paths; legacy shells untouched.

---

## Phase 3: User Story 1 - Accountless device setup via URL (Priority: P1) 🎯 MVP

**Goal**: Merchant sets up a new device from its public URL with no account (already exists under `app/(redirect)/[slug]/setup/` — must keep working unchanged).

**Independent Test**: Navigate to an unclaimed device URL, enter a valid claim code, choose single-link, select a Google Place, verify the device is active and redirects on scan (quickstart Scenario 3–5).

### Tests for User Story 1

- [x] T011 [P] [US1] Verify existing `tests/e2e` setup flow still passes (`npm run test:e2e`) after the route-group restructure; fix any `app/(redirect)` path regressions in `tests/`

### Implementation for User Story 1

- [x] T012 [P] [US1] Confirm setup routes stay in `(redirect)` with NO next-themes provider and centered minimal card (FR-030/034): `app/(redirect)/[slug]/setup/page.tsx`, `app/(redirect)/[slug]/setup/redirect/page.tsx`, `app/(redirect)/[slug]/setup/loading.tsx`
- [x] T013 [US1] Route `app/(auth)/register-claim/page.tsx` claim-code registration through the shared permission role resolution (US2 binding); no UI change beyond keeping the centered card + framer-motion

**Checkpoint**: US1 works anonymously on the new structure.

---

## Phase 4: User Story 2 - Merchant claims device from dashboard with account (Priority: P1)

**Goal**: Logged-in merchant claims a device by claim code from the dashboard (login-or-register choice), routed at root path `/devices/claim`.

**Independent Test**: Log in, enter a valid claim code at `/devices/claim`, verify the device appears in the device list with correct organization association (quickstart Scenario 6, 9).

### Tests for User Story 2

- [x] T014 [P] [US2] Unit tests for `registerWithClaimCode`/`claimWithCode` binding rules in `domains/merchant/__tests__/` (boundUserId null→set; already-bound rejected "code already used"; cross-org code rejected) — per data-model.md `device.claimCodeHash`
- [x] T015 [P] [US2] E2E: sub-merchant register-with-code + dashboard isolation in `tests/e2e/org-claim.spec.ts` against the new `/devices/claim` path

### Implementation for User Story 2

- [x] T016 [P] [US2] Move claim UI to `app/(dashboard)/devices/claim/page.tsx` (root path, from legacy `app/(merchant)/devices/claim/`): claim-code input → login-or-register selection → association result; toasts on success/error; phantom-ui skeleton (FR-031/033); rejects cross-org codes
- [x] T017 [US2] Point the register-claim flow at the shared claim service so a claim code from `/register-claim` is still honored from the auth area

**Checkpoint**: US2 works at `/devices/claim`; US1 unchanged.

---

## Phase 5: User Story 3 - Customer scans a device and reaches its destination (Priority: P1)

**Goal**: Public scan resolution at `/s/[slug]` — single-link redirect, multi-link landing, inactive message, scan_event recorded server-side. Already implemented in `app/(redirect)/s/[slug]/`; must survive the restructure.

**Independent Test**: Scan a seeded published single-link device → immediate redirect; multi-link device → landing page; unpublished/disabled device → inactive message (quickstart Scenario 4–5).

### Tests for User Story 3

- [x] T018 [P] [US3] Verify `tests/e2e` scan specs pass unmodified after restructure; confirm `scan_event` recorded exactly once per request (SC-003)

### Implementation for User Story 3

- [x] T019 [P] [US3] Keep `app/(redirect)/s/[slug]/page.tsx` as the single public scan surface; assert NO theme provider and no authenticated layout (FR-034); keep per-device SEO metadata and mobile-first WCAG AA rendering (public-scan.md)

**Checkpoint**: US3 fully functional on the new structure with no changes required.

---

## Phase 6: User Story 4 - Reseller manages devices, analytics, and sub-merchants (Priority: P2)

**Goal**: Owner (reseller) dashboard at root paths `/dashboard`, `/devices`, `/devices/[id]`, `/devices/[id]/settings`, `/user-management` — analytics inline on `/dashboard`, member management under `/user-management`; sidebar and access from the permission model.

**Independent Test**: Log in as owner; see all org devices incl. member-assigned, analytics sections on `/dashboard`, `/user-management` member list with roles/assigned devices; owner reset keeps `organizationId` (quickstart Scenario 7).

### Tests for User Story 4

- [x] T020 [P] [US4] E2E: owner dashboard — device list, analytics on `/dashboard`, invite member, owner reset in `tests/e2e/owner-dashboard.spec.ts` (update paths from legacy `(merchant)` routes)
- [x] T021 [P] [US4] Unit tests for owner-only authorization: analytics + member management denied to `member`; owner sees all org devices — in `domains/{merchant,analytics}/__tests__/` (SC-008)

### Implementation for User Story 4

- [x] T022 [P] [US4] Migrate `app/(merchant)/dashboard/page.tsx` → `app/(dashboard)/dashboard/page.tsx` (root `/dashboard`): role-aware; owner sees org overview + analytics section (totals, daily, per-device, browser/device/country/city/referrer); member sees device-focused view; TanStack prefetch + phantom-ui skeleton (FR-033)
- [x] T023 [P] [US4] Migrate `app/(merchant)/members/page.tsx` + `app/(merchant)/members/[memberId]/page.tsx` → `app/(dashboard)/user-management/page.tsx` + `[memberId]/page.tsx` (root `/user-management`): member table, invite form, role display, assigned devices, reassign — toasts on every action (FR-031); owner-gated in-page and via permission model (FR-037)
- [x] T024 [P] [US4] Migrate `app/(merchant)/devices/[id]/settings/page.tsx` → `app/(dashboard)/devices/[id]/settings/page.tsx`: owner reset (keep-org) with confirmation dialog, assign-to-member selector, unpublish danger actions — each with toast
- [x] T025 [US4] Ensure analytics aggregation ops `overview()`/`breakdown()` stay owner-only and are consumed by the `/dashboard` section (not a standalone route); remove any legacy `app/(merchant)/analytics/` + `app/(merchant)/(sub-merchant)/analytics/` pages

**Checkpoint**: Owner dashboard fully functional at root paths; legacy `(merchant)` dashboard pages removed.

---

## Phase 7: User Story 5 - Sub-merchant manages devices (Priority: P2)

**Goal**: Sub-merchant (member) sees only assigned devices at `/devices`; configures them; denied `/user-management` and analytics.

**Independent Test**: Log in as sub-merchant; only assigned devices listed; `/user-management` not accessible; analytics absent from `/dashboard` (quickstart Scenario 8).

### Tests for User Story 5

- [x] T026 [P] [US5] E2E: sub-merchant access control — member sees only assigned devices, `/user-management` denied in `tests/e2e/sub-merchant-access.spec.ts` (update paths)
- [x] T027 [P] [US5] Unit tests for member-scoped `listVisible()` in `domains/device/__tests__/`: member → devices where `device.memberId = member.id`; never org-wide (FR-025/027)

### Implementation for User Story 5

- [x] T028 [P] [US5] Migrate `app/(merchant)/devices/page.tsx` + `app/(merchant)/(sub-merchant)/devices/*` → `app/(dashboard)/devices/page.tsx` honoring role: owner sees all (US4), member sees only assigned; row actions limited to configure/publish/unpublish for members — toasts + skeleton + empty state
- [x] T029 [US5] Delete legacy `app/(merchant)/(sub-merchant)/` directory tree entirely after migration; confirm the shared `(dashboard)` layout no longer references the nested group

**Checkpoint**: Member isolation enforced at root paths; nested group deleted.

---

## Phase 8: User Story 6 - Admin manages devices and merchants (Priority: P2)

**Goal**: Admin at root paths `/devices/new` (create + assign org), `/devices` (inventory, disable/enable), `/merchants` (org list with device counts).

**Independent Test**: Create several devices, verify distinct identities + claim codes, assign one to a reseller org, disable one, list merchant orgs (quickstart Scenario 2).

### Tests for User Story 6

- [x] T030 [P] [US6] Unit tests: admin device create + slug uniqueness + disable/enable in `domains/device/__tests__/`; admin reset scope (clears `organizationId`) in `domains/device/__tests__/` (data-model.md `device.slug`: `unique, lowercase alphanumeric + hyphen, 6–32 chars, never reused`)
- [x] T031 [P] [US6] E2E: admin create+assign, disable, admin reset in `tests/e2e/admin-devices.spec.ts` (update paths from legacy `app/(admin)/admin/devices/`)

### Implementation for User Story 6

- [x] T032 (superseded by T052) Migrate `app/(admin)/admin/devices/new/page.tsx` → admin create via dialog view (FR-040)
- [x] T033 [P] [US6] Migrate `app/(admin)/admin/devices/page.tsx` → `app/(dashboard)/devices/page.tsx` (admin inventory branch): disable/enable, admin reset dialog, toasts
- [x] T034 [US6] Migrate `app/(admin)/admin/merchants/page.tsx` (and `organizations/page.tsx` if present) → `app/(dashboard)/merchants/page.tsx` (root `/merchants`): org list with device counts; admin-only via permission model

**Checkpoint**: Admin works at root paths; legacy `app/(admin)/` tree removable (do it in Polish).

---

## Phase 9: User Story 7 - Merchant attaches a Google review destination (Priority: P2)

**Goal**: Google Places search + place selection + derived review URL for a device — used by accountless setup (US1) and dashboard editing (US5).

**Independent Test**: Search a place, select a listing, attach as single-link, verify the generated review link on scan (quickstart Scenario 7/9).

### Tests for User Story 7

- [x] T035 [P] [US7] Unit tests for `generateReviewUrl(placeId)` deriving `https://search.google.com/local/writereview?placeid=<PLACE_ID>` and `place.placeId` required for `GOOGLE_REVIEW` (data-model.md) in `domains/destination/__tests__/`
- [x] T036 [P] [US7] Integrate Google Places in existing `domains/destination/server/` tests — `searchPlaces(query)` empty-result → "no results" (US7 AC4)

### Implementation for User Story 7

- [x] T037 [P] [US7] Reuse the existing destination editor `components/forms/destination-editor.tsx` (single/multi rows, Google Places search, per-type Zod validation) in both `app/(dashboard)/devices/[id]/page.tsx` and `app/(redirect)/[slug]/setup/redirect/`; validate `WEBSITE`/`CUSTOM_URL`/`WHATSAPP` are absolute `http(s)`/`whatsapp://wa.me` URLs; null derived review URL on edit until re-derived (data-model.md)

**Checkpoint**: Google review destination fully functional in both flows.

---

## Phase 10: User Story 8 - Visitor views the marketing homepage (Priority: P2)

**Goal**: Public homepage at `/` in `(landing-page)` — branding, SEO metadata, register/login links, responsive.

**Independent Test**: Open `/` unauthenticated; branding + SEO metadata render; register/login links work (quickstart Scenario 1).

### Tests for User Story 8

- [x] T038 [P] [US8] E2E: homepage renders branding + register link in `tests/e2e/homepage.spec.ts` (or existing equivalent); assert `robots.txt`/`sitemap.xml` respond

### Implementation for User Story 8

- [x] T039 [P] [US8] Confirm the marketing page lives in `app/(landing-page)/page.tsx` with `robots.ts` + `sitemap.ts` in the same group; server-rendered with title/description/canonical/OG (FR-019/020); responsive (390px); register/login links intact
- [x] T040 [P] [US8] Add `next-themes` to `app/(landing-page)/layout.tsx` (sync, no fetch) so the public homepage follows the theme without touching the root layout (FR-034)

**Checkpoint**: Homepage live at root; all stories migrated.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Remove legacy structure, restore the sky-blue + framer-motion design, enforce theme scope, full test sweep.

- [x] T041 [P] Delete the legacy route groups and any stragglers: `app/(admin)/`, `app/(merchant)/`, `app/analytics`, `app/dashboard`, `app/devices` (verify no imports remain — `npm run typecheck` must stay clean)
- [x] T042 [P] Apply framer-motion staggered entrance to `app/(auth)/login/page.tsx` + `app/(auth)/register/page.tsx`: card fade-in, form field slide-up with delay stagger, button entrance (client component, `'use client'`); sky-blue gradient background — `from-white via-sky-50/40 to-blue-50/60` light, `from-neutral-950 via-sky-950/10 to-blue-950/20` dark with sky-tinted radial overlays (FR-035); centered on both axes (FR-030); NEVER on any dashboard page
- [x] T043 [P] Add a light/dark contrast check for the auth gradient and sidebar chrome (FR-032); fix any WCAG AA contrast violations on sky-blue accents
- [x] T044 [P] Audit theme scope: `next-themes` provider present ONLY in `(auth)`, `(landing-page)`, `(dashboard)` layouts; absent from root `app/layout.tsx` and `(redirect)` (FR-034) — add a unit/type-level check or e2e assertion (`tests/unit/theme-scope.test.ts`)
- [x] T045 [P] WCAG AA audit of public surfaces (`/s/[slug]`, setup flow, homepage) and dashboard: keyboard nav, focus states, contrast (US8/SC-007)
- [x] T046 Run `npm run lint`, `npm run typecheck`, `npm run coverage` (≥90%), `npm run build`, then `npm run test:e2e` against the prod build (`db:migrate` → `db:seed:e2e` → `build` → `next start`, isolated `review_cepat_test` DB) — full green required
- [x] T047 Confirm quickstart.md Scenarios 1–10 all pass locally on the new structure; fix any scenario drift
- [x] T048 [P] [Clarification 2026-09-16] Add the reusable `DataTable` component at `components/ui/data-table/` mirroring the reference project (`khitan-plus-hipnosis/components/ui/data-table/`): `data-table.tsx` + `data-table-header.tsx` + `data-table-pagination.tsx` + `data-table-skeleton.tsx` + `data-table-view-options.tsx`, built on `@tanstack/react-table` over the existing `components/ui/table.tsx` primitives; use it for ALL dashboard data views (device lists, members, merchants, organizations, analytics breakdowns) instead of hand-rolled static `Table` markup (FR-038)
- [x] T049 (superseded by T054/T055) Legacy API-endpoint `permission` rows + `parent_id` self-reference + `can(role, orgRole, path)` at the API layer (FR-037)

---

## Phase 12: Convergence (legacy clarifications)

**Purpose**: FR-039 (confirmation dialogs) + FR-040 (create/delete dialogs, admin soft-delete) — ratified Session 2026-09-16.

- [x] T050 [US4] Wrap every device/member state-changing dashboard action in a confirmation dialog before mutation per FR-039: publish/unpublish in `app/(dashboard)/devices/devices-client.tsx`, unpublish + assign in `app/(dashboard)/devices/[id]/settings/settings-client.tsx`, assign/unassign in `app/(dashboard)/user-management/[memberId]/member-detail-client.tsx`; Dialog states the action + Confirm/Cancel
- [x] T051 [US6] Implement admin-only soft delete of devices per FR-040: add `deleted` to `domains/device/constants.ts` `DEVICE_STATUS`; `deleteDevice(id)` service (keeps org/destinations/scans retained; `deleted` status, hidden from all lists); `deleteDeviceAction` Server Action; `/api/device/delete` permission row in `db/seed/permissions.ts`; admin delete confirmed via dialog (no DB row removal)
- [x] T052 [US6] Rework admin device create to a dialog view per FR-040: render the create form as a dialog on the admin `/devices` inventory instead; reconcile `db/seed/permissions.ts` `/devices/new` nav row (drop or point to `/devices`) and reparent `api.create_device` to `/devices`
- [x] T053 Create `app/(dashboard)/settings/page.tsx` (profile/org/theme) so the seeded `/settings` nav row resolves for all roles per plan.md structure and FR-037

---

## Phase 13: Permission Normalization + ADMIN Superuser + Role-Based List APIs (FR-036/037/041/042-043)

**Purpose**: Migrate the legacy `permission.roles` JSON model to the normalized `master_role`/`permission`/`role_permission` model, implement ADMIN guard bypass, and serve nav client-side — Clarifications Session 2026-09-16. SUPERSEDES T002/T005/T006/T008/T049.

**Independent Test**: ADMIN can reach every seeded page/API path without a permission-table lookup (SC-011); sidebar nav renders client-side with phantom-ui skeleton and `layout.tsx` does no fetch (SC-013); `GET /api/permissions` returns the caller's own allowed paths; `GET /api/roles/:roleId/permissions` (admin-only) returns a role's permission mapping (quickstart Scenario 10).

### Tests (write first, assert FAIL before implementing)

- [x] T054 [P] Unit tests for normalized permission resolution in `tests/unit/auth/permissions.test.ts`: `can('ADMIN', null, path)` returns true for ANY path WITHOUT a DB lookup (mock the db to prove no read) (FR-041); `can('MERCHANT', 'owner', path)` true only when a `role_permission` link with `scope` in (`owner`/null/both) matches; `can('MERCHANT', 'member', path)` false for `scope=owner` links (Edge Cases Session 2026-09-16)
- [x] T055 [P] Unit tests for the two list APIs in `tests/unit/auth/` + `tests/unit/lib/api-route.test.ts`: `GET /api/permissions` (authenticated any role) returns only caller's permitted nav+API paths, ordered by `sort`; `GET /api/roles/:roleId/permissions` returns 403 for MERCHANT and 200 with the role→permission mapping for ADMIN (FR-042)

### Schema migrations

- [x] T056 [P] Add `master_role` table to `db/schema/index.ts`: `id` (uuid PK), `name` (varchar unique non-null, seeded values `ADMIN`, `MERCHANT`), `description?` (varchar), `createdAt` (timestamp non-null); add `role_permission` table: `id` (uuid PK), `role_id` (varchar(36) FK → `master_role.id`, not null), `permission_id` (varchar(36) FK → `permission.id`, not null), `scope` (varchar(10), nullable, allowed `owner` | `member` | `both`), `createdAt` (timestamp non-null); unique index on (`role_id`, `permission_id`, `scope`); run `npm run db:generate` + `npm run db:migrate` (data-model.md master_role/role_permission)
- [x] T057 [P] Drop the `roles` JSON column from the `permission` table in `db/schema/index.ts` (`path` unique, `label`, `icon?`, `is_menu`, `parent_id?`, `sort`, `createdAt` — NO role column); run `npm run db:generate` + `npm run db:migrate` (FR-037)

### Seed

- [x] T058 [P] Rewrite `db/seed/permissions.ts` to the normalized model: seed `master_role` (ADMIN, MERCHANT); seed `permission` rows (nav + API-endpoint rows, no role column); seed `role_permission` links — ADMIN→every permission (no scope), MERCHANT→Dashboard/Devices/Settings (+`/user-management`/`/api/member/*` and `/api/device/reset` with `scope=owner`, claim with no scope); verify `MERCHANT:owner`/`MERCHANT:member` tokens no longer exist anywhere; keep `/api/permissions` (all roles) and `/api/roles/:roleId/permissions` (ADMIN-only) as API-endpoint rows with `is_menu=false`; run `npm run db:seed` (FR-037, data-model.md seed strategy)
- [x] T059 [P] Update `db/seed/e2e.ts` to reseed the same normalized rows so e2e runs match the seed; assert `tests/unit/db/permissions-seed.test.ts` passes against the new shape

### Domain service (ADMIN bypass + client nav + list APIs)

- [x] T060 [P] Refactor `domains/auth/server/permissions.ts`: `can(role, orgRole, path)` → `if (role === 'ADMIN') return true` (no DB read); for MERCHANT, join `permission`+`role_permission` and match link scope against `orgRole`; replace `roleMatches`/`findPermissionForPath` with the join query; keep `listNavForRole(role, orgRole)` as a server helper backing the self-list used by `GET /api/permissions` (FR-037/041)
- [x] T061 [P] Add `app/api/permissions/route.ts`: authenticated (ADMIN or MERCHANT) — returns caller's permitted nav items (`is_menu=true`, ordered by `sort`) + API paths (`is_menu=false`), via `listNavForRole`-equivalent on the normalized model (FR-042)
- [x] T062 [P] Add `domains/auth/api/queries.ts` `permissionsKeys` + `permissionsQueries.self()` (GET `/api/permissions`) and `rolePermissions(roleId)` (GET `/api/roles/:roleId/permissions`), typed through `lib/http` (constitution III)
- [x] T063 Add `app/api/roles/[roleId]/permissions/route.ts`: admin-only via `requireApiPermission('/api/roles/:roleId/permissions')` + `requireRole('ADMIN')`; returns the role's `permission` rows via `role_permission` links, ordered by `sort` (FR-042)

### Client-side nav (layout stays sync)

- [x] T064 [P] Change `app/(dashboard)/layout.tsx`: remove `dynamic = 'force-dynamic'`, remove `getRole`/`listNavForRole` import + `const nav = await listNavForRole(...)`; keep `requireRole` for auth only; pass NO nav prop to `AppSidebar` (FR-043, constitution II — no fetch in layout)
- [x] T065 [P] Update `components/layout/dashboard/app-sidebar.tsx`: fetch nav client-side via `useQuery(permissionsQueries.self())`; if needed (not prefetched) wrap the menu in phantom-ui skeleton (`<phantom-ui loading>` per plan.md) while `isPending`; render same NavMain/NavUser structure from the fetched nav (FR-043)

---

## Phase 14: Admin Dashboard Analytics + Date-Range Picker (FR-044)

**Purpose**: Admin `/dashboard` shows all-merchant analytics aggregated across every organization's devices, filterable by a date-range picker — Clarification Session 2026-09-16.

**Independent Test**: As ADMIN, `/dashboard` shows total/daily/per-device scans across ALL merchants; selecting "Last 7 days" or a custom `from`/`to` updates the numbers to that window; invalid ranges rejected (SC-012, quickstart Scenario 10).

### Tests

- [x] T066 [P] Unit tests in `tests/unit/analytics/service.test.ts`: `overview(userId, from?, to?)` filters `scan_event.createdAt` to `[from, to]` (inclusive) when provided and returns all rows when omitted; `adminOverview(userId, from?, to?)` aggregates across ALL organizations (no org filter) and is rejected for non-ADMIN; zero-filled result for an empty window (no scans → total 0 + empty daily/per-device arrays) (FR-044, Edge Cases)
- [x] T067 [P] Unit tests for date validation in `tests/unit/lib/` + `tests/unit/analytics/`: `from` > `to` and ranges open on either end are rejected with a clear error (Zod at the route boundary, constitution VII)
- [x] T068 [P] E2E in `tests/e2e/analytics.spec.ts` (or new `admin-dashboard.spec.ts`): as ADMIN select a preset range and a custom range; assert totals/daily/per-device update and the picker button shows the selected range; invalid range shows an error (SC-012)

### Implementation

- [x] T069 [P] Add `date-fns` to `package.json` dependencies (`npm i date-fns`) (required by the reference picker)
- [x] T070 [P] Add shadcn `calendar` + `popover` components (`npx shadcn@latest add calendar popover` — Base UI primitives per FR-029); verify `components/ui/calendar.tsx` + `components/ui/popover.tsx` generated
- [x] T071 [P] Port the reference `date-range-picker` to `components/ui/date-range-picker.tsx` from `khitan-plus-hipnosis/components/ui/date-range-picker.tsx`: presets (today, yesterday, last 7/14/30 days, this month, last month, this year), 2-month range calendar, reset/apply buttons, `DateRange` type `{ from, to }`; strip the `useI18n`/`Dictionary` dependency — hardcode English labels (this project has no i18n); use local `Button`/`Calendar`/`Popover`/`Separator` (FR-044)
- [x] T072 [P] Extend `domains/analytics/server/service.ts`: `overview(userId, from?: Date, to?: Date)` adds `and(gte(scanEvent.createdAt, from), lte(scanEvent.createdAt, to))` to total/daily/per-device queries; add `adminOverview(userId, from?, to?)` — guards `user.role === 'ADMIN'`, queries ALL `scan_event` rows (optionally date-filtered) with the same daily/per-device shape (FR-044)
- [x] T073 [P] Update `app/api/analytics/overview/route.ts` to parse `from`/`to` query params as dates (Zod `date`), reject invalid/`from > to`/open-ended ranges with a clear error; add `app/api/analytics/admin-overview/route.ts` — admin-only via `requireApiUser(['ADMIN'])`, same `from`/`to` parsing (FR-044)
- [x] T074 [P] Update `domains/analytics/api/queries.ts`: `overview(from?, to?)` and `adminOverview(from?, to?)` query keys include the range so date changes refetch; wire `adminOverview` through `lib/http` (FR-044)
- [x] T075 [US6] Rework `app/(dashboard)/dashboard/admin-dashboard-client.tsx`: render analytics StatCards (total scans, published devices) + per-device and daily breakdowns from `adminOverview` via `useQuery`, with the `DateRangePicker` (T071) controlling `from`/`to`; phantom-ui skeleton while loading; empty state for no scans; keep the existing navigation cards (FR-044)
- [x] T076 [P] Register `/api/analytics/admin-overview` as an admin permission row (ADMIN link in `role_permission`, `is_menu=false`, parent `/dashboard`) in `db/seed/permissions.ts` (FR-037/044)

---

## Phase 15: Polish & Final Verification (post-normalization)

**Purpose**: Sweep legacy structures, re-run full verification with the normalized permission model.

- [x] T077 [P] Delete any legacy permission files/columns left over: `domains/auth/server/permissions.ts` stripped of `roleMatches`/`findPermissionForPath` legacy helpers; `tests/unit/auth/permissions.test.ts` legacy cases removed; confirm no `permission.roles` or `MERCHANT:owner`/`MERCHANT:member` token references remain in `app/`, `domains/`, `db/`, `tests/` (grep — FR-037)
- [x] T078 Run `npm run lint`, `npm run typecheck`, `npm run coverage` (≥90%), `npm run build`, then `npm run test:e2e` against the prod build (isolated `review_cepat_test` DB) — full green required
- [x] T079 Update quickstart.md if any scenario drift is found during T047/T078; confirm Scenarios 1–10 pass (FR-041/042/043/044)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**:
  - US1 (Phase 3), US3 (Phase 5): depend only on Foundational (public `(redirect)` surfaces, mostly preserve-only)
  - US2 (Phase 4): depends on Foundational (permission role resolution)
  - US4 (Phase 6): depends on Foundational shell (T009/T010). US5 (Phase 7) and US6 (Phase 8) depend on US4's migrated shared layout but are file-disjoint afterward
  - US7 (Phase 9): depends on US1/US5 destination editor integration, no new routes
  - US8 (Phase 10): independent of all other stories
- **Phase 13 (permission normalization)**: Depends on Phase 2 legacy shell being stable; MUST precede Phase 14 (admin list APIs + client nav) and final verification
- **Phase 14 (admin analytics)**: Depends on Phase 13 (client nav + list APIs) and on US4 analytics shape (T025) for the admin aggregate
- **Polish (Phase 11, 15)**: Depends on all stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no cross-story deps
- **US2 (P1)**: After Foundational — shares claim service with US1
- **US3 (P1)**: After Foundational — preserve-only
- **US4 (P2)**: After Foundational
- **US5 (P2)**: After US4 shell; file-disjoint once migrated
- **US6 (P2)**: After US4 shell; file-disjoint
- **US7 (P2)**: After US1 + US5 (shared destination editor)
- **US8 (P2)**: Independent
- **Permission normalization (FR-036/037/041-043)**: Cross-cutting — must complete before admin analytics (Phase 14) and before final verification (Phase 15)

### Within Each User Story

- Tests first (FALSE-FAIL where new logic), then implementation, then deletion of legacy files
- Migrate pages before deleting legacy groups

### Parallel Opportunities

- Phase 13 schema tasks (T056/T057), seed (T058/T059), service (T060), routes (T061/T063) are file-disjoint — [P]
- Phase 14 tasks T066–T076 are file-disjoint except ordering tests-first → implementation; direction: T066/T067/T068 tests → T069/T070/T071/T072/T073/T074 implementation → T075 integration → T076 seed row

---

## Parallel Example: Phase 13

```bash
# Launch schema + service + routes together (file-disjoint):
Task: "Add master_role + role_permission tables to db/schema/index.ts (T056)"
Task: "Drop permission.roles column (T057)"
Task: "Rewrite db/seed/permissions.ts to normalized model (T058)"
Task: "Refactor domains/auth/server/permissions.ts with ADMIN bypass (T060)"
Task: "Add app/api/permissions/route.ts + app/api/roles/[roleId]/permissions/route.ts (T061/T063)"

# After those pass:
Task: "Make (dashboard)/layout.tsx sync + AppSidebar client-side nav fetch (T064/T065)"
```

---

## Parallel Example: Phase 14

```bash
# Tests first (FALSE-FAIL):
Task: "Unit tests overview/adminOverview date filtering (T066)"
Task: "Unit tests date validation (T067)"
Task: "E2E admin dashboard date filter (T068)"

# Then implementation (file-disjoint):
Task: "Add date-fns + shadcn calendar/popover (T069/T070)"
Task: "Port date-range-picker.tsx (T071)"
Task: "Extend analytics service overview + adminOverview (T072)"
Task: "Update analytics routes with from/to parsing (T073)"

# Then integration:
Task: "Update admin-dashboard-client.tsx with picker + adminOverview (T075)"
Task: "Seed /api/analytics/admin-overview permission row (T076)"
```

---

## Implementation Strategy

### MVP First (US1 + US3 + US8 — no legacy migration risk)

1. Phase 1 + Phase 2 (permission table, seed, proxy, guard, shared shell)
2. Verify US1 (setup), US3 (scan), US8 (homepage) untouched on the new structure
3. **STOP and VALIDATE** — preserve-only stories; confirm no regression
4. Deploy/demo if ready

### Incremental Delivery

1. Foundation (Phases 1–2) → permission nav works
2. US1/US3/US8 (preserve + homepage theme) → MVP public surface
3. US2 (claim) → root-path claim works
4. US4 → US5 → US6 (dashboard migrations, biggest UI work)
5. US7 (Google review) → full feature set
6. Phase 13: normalize permissions + ADMIN bypass + list APIs + client nav
7. Phase 14: admin analytics with date-range picker
8. Polish: delete legacy groups, framer-motion auth, WCAG, full suite

### Parallel Team Strategy

With multiple developers:

1. Setup + Foundational together (T001–T010)
2. Once done:
   - Developer A: US4 dashboard shell + migration
   - Developer B: US7 destination editor
   - Developer C: US8 homepage + US2 claim
3. US5/US6 follow US4 as file-disjoint page migrations
4. Phase 13: one dev on schema/seed, one on service/routes
5. Phase 14: one dev on picker/UI, one on analytics service + routes

---

## Notes

- This tasks.md supersedes the legacy implementation task log; legacy `permission.roles` model is replaced by `master_role`/`permission`/`role_permission` (FR-037) — tasks T002/T005/T006/T008/T049 are superseded, not re-run
- ADMIN is a superuser at the guard layer only (FR-041); ADMIN links are still seeded so nav/self-list render all items from real rows
- `layout.tsx` NEVER fetches nav server-side (FR-043, constitution II); sidebar loads client-side via `GET /api/permissions` with phantom-ui skeleton
- Permission rows are the single source of truth for sidebar nav + endpoint access — a page without a matching `permission`/`role_permission` row for the role is unreachable
- Migrations must keep `npm run typecheck` green at every checkpoint
- Verification commands: `npm run coverage` (≥90%), `npm run test:e2e`, `npm run build`