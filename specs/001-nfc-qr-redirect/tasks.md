---

description: "Task list for the NFC QR Redirect platform UI rebuild + route restructure"
---

# Tasks: NFC QR Redirect Platform

**Input**: Design documents from `/specs/001-nfc-qr-redirect/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project (Next.js App Router): `app/`, `domains/`, `components/`, `db/`, `tests/` at repository root
- Route groups are exactly four: `(auth)`, `(dashboard)`, `(landing-page)`, `(redirect)` (FR-036)
- All roles share root-level paths inside `(dashboard)`; nav/access comes from the seeded `permission` table (FR-037)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Close the gap between the current repo state and the plan's target foundation.

- [x] T001 Add `framer-motion` to `package.json` dependencies and run `npm i`
- [x] T002 [P] Add the `permission` table to `db/schema/index.ts` (`path` unique non-null, `label` non-null, `icon?`, `is_menu` boolean, `roles` non-empty array, `sort` int, `createdAt`) and export it; run `npm run db:generate` and `npm run db:migrate` (FR-037)
- [x] T003 [P] Delete legacy root-level empty route dirs `app/analytics`, `app/dashboard`, `app/devices`, `app/login`, `app/register` (their real pages live under route groups)
- [x] T004 Verify `next-themes` provider is NOT present in `app/layout.tsx` root (theme mounts only in `(auth)`, `(landing-page)`, `(dashboard)` layouts — FR-034)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented — permission-driven nav/access, seed data, and the shared authenticated shell.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create `domains/auth/server/permissions.ts`: `listNavForRole(role)` returns `permission` rows where `is_menu=true` for the role ordered by `sort`; `can(role, path)` returns whether the role has a matching `permission` row; `getRole()` resolves `ADMIN` / `OWNER` / `MEMBER` from the session (Better Auth org role for merchant, `user.role` for admin) (FR-036)
- [x] T006 [P] Extend `db/seed.ts` (and `db/seed/e2e.ts` cherry-picking) to insert per-role `permission` rows: admin → `/dashboard`, `/devices`, `/devices/new`, `/user-management`, `/merchants`, `/settings` (menu: Dashboard/Devices/User management/Merchants/Settings); owner → `/dashboard`, `/devices`, `/devices/claim`, `/user-management`, `/settings`; member → `/dashboard`, `/devices`, `/devices/claim`, `/settings` (FR-037)
- [x] T007 [P] Add a Next.js 16 `proxy.ts` at repo root: resolve the Better Auth session; when authenticated, deny routes where `can(role, path)` is false (redirect to `/dashboard`); when unauthenticated, redirect protected `(dashboard)` paths to `/login`; keep public `(redirect)` + `(landing-page)` paths open; run `npm run typecheck`
- [x] T008 [P] Wire `listNavForRole(role)` into the sidebar data source in `domains/auth/` so `(dashboard)/layout.tsx` renders nav from `permission` rows (is_menu=true) instead of hardcoded arrays; add `accessDenied(...)` guard helper used by the layout
- [x] T009 Create the shared `(dashboard)` authenticated shell: `app/(dashboard)/layout.tsx` (auth guard via `domains/auth/server/permissions.ts`, shadcn `sidebar` with reference layout — brand header, NavMain, NavUser, inset variant, `SidebarTrigger | Separator | Breadcrumb | ThemeToggle` header), `app/(dashboard)/loading.tsx` + `app/(dashboard)/error.tsx`
- [x] T010 [P] Move the themed sidebar shell out of the legacy `(admin)`/`(merchant)` layouts into the shared `(dashboard)` shell; delete `components/layout/app-shell.tsx`'s route-group assumptions and reuse it from `(dashboard)/layout.tsx` only

**Checkpoint**: Foundation ready — `permission`-driven nav works for all three roles under `(dashboard)` root paths; legacy shells untouched.

---

## Phase 3: User Story 1 - Accountless device setup via URL (Priority: P1) 🎯 MVP

**Goal**: Merchant sets up a new device from its public URL with no account (already exists under `app/(redirect)/[slug]/setup/` — must keep working unchanged).

**Independent Test**: Navigate to an unclaimed device URL, enter a valid claim code, choose single-link, select a Google Place, verify the device is active and redirects on scan (quickstart Scenario 3–5).

### Tests for User Story 1

- [x] T011 [P] [US1] Verify existing `tests/e2e` setup flow still passes (`npm run test:e2e`) after the route-group restructure; fix any `app/(redirect)` path regressions in `tests/`

### Implementation for User Story 1

- [x] T012 [P] [US1] Confirm setup routes stay in `(redirect)` with NO next-themes provider and centered minimal card (FR-030/034): `app/(redirect)/[slug]/setup/page.tsx`, `app/(redirect)/[slug]/setup/redirect/page.tsx`, `app/(redirect)/[slug]/setup/loading.tsx`
- [x] T013 [US1] Route `app/(auth)/register-claim/page.tsx` claim-code registration through the shared `domains/auth/server/permissions.ts` role resolution (US2 binding); no UI change beyond keeping the centered card + framer-motion

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

**Goal**: Owner (reseller) dashboard at root paths `/dashboard`, `/devices`, `/devices/[id]`, `/devices/[id]/settings`, `/user-management` — analytics inline on `/dashboard`, member management under `/user-management`; sidebar and access from `permission` table.

**Independent Test**: Log in as owner; see all org devices incl. member-assigned, analytics sections on `/dashboard`, `/user-management` member list with roles/assigned devices; owner reset keeps `organizationId` (quickstart Scenario 7).

### Tests for User Story 4

- [x] T020 [P] [US4] E2E: owner dashboard — device list, analytics on `/dashboard`, invite member, owner reset in `tests/e2e/owner-dashboard.spec.ts` (update paths from legacy `(merchant)` routes)
- [x] T021 [P] [US4] Unit tests for owner-only authorization: analytics + member management denied to `member`; owner sees all org devices — in `domains/{merchant,analytics}/__tests__/` (SC-008)

### Implementation for User Story 4

- [x] T022 [P] [US4] Migrate `app/(merchant)/dashboard/page.tsx` → `app/(dashboard)/dashboard/page.tsx` (root `/dashboard`): role-aware; owner sees org overview + analytics section (totals, daily, per-device, browser/device/country/city/referrer); member sees device-focused view; TanStack prefetch + phantom-ui skeleton (FR-033)
- [x] T023 [P] [US4] Migrate `app/(merchant)/members/page.tsx` + `app/(merchant)/members/[memberId]/page.tsx` → `app/(dashboard)/user-management/page.tsx` + `[memberId]/page.tsx` (root `/user-management`): member table, invite form, role display, assigned devices, reassign — toasts on every action (FR-031); owner-gated in-page and via `permission` (FR-037)
- [x] T024 [P] [US4] Migrate `app/(merchant)/devices/[id]/settings/page.tsx` → `app/(dashboard)/devices/[id]/settings/page.tsx`: owner reset (keep-org) with confirmation dialog, assign-to-member selector, unpublish danger actions — each with toast
- [x] T025 [US4] Ensure analytics aggregation ops `overview()`/`breakdown()` stay owner-only and are consumed by the `/dashboard` section (not a standalone route); remove any legacy `app/(merchant)/analytics/` + `app/(merchant)/(sub-merchant)/analytics/` pages

**Checkpoint**: Owner dashboard fully functional at root paths; legacy `(merchant)` dashboard pages removed.

---

## Phase 7: User Story 5 - Sub-merchant manages devices (Priority: P2)

**Goal**: Sub-merchant (member) sees only assigned devices at `/devices`; configures them; denied `/user-management` and analytics.

**Independent Test**: Log in as sub-merchant; only assigned devices listed; `/user-management` not accessible; analytics absent from `/dashboard` (quickstart Scenario 8).

### Tests for User Story 5

- [ ] T026 [P] [US5] E2E: sub-merchant access control — member sees only assigned devices, `/user-management` denied in `tests/e2e/sub-merchant-access.spec.ts` (update paths)
- [ ] T027 [P] [US5] Unit tests for member-scoped `listVisible()` in `domains/device/__tests__/`: member → devices where `device.memberId = member.id`; never org-wide (FR-025/027)

### Implementation for User Story 5

- [ ] T028 [P] [US5] Migrate `app/(merchant)/devices/page.tsx` + `app/(merchant)/(sub-merchant)/devices/*` → `app/(dashboard)/devices/page.tsx` honoring role: owner sees all (US4), member sees only assigned; row actions limited to configure/publish/unpublish for members — toasts + skeleton + empty state
- [ ] T029 [US5] Delete legacy `app/(merchant)/(sub-merchant)/` directory tree entirely after migration; confirm the shared `(dashboard)` layout no longer references the nested group

**Checkpoint**: Member isolation enforced at root paths; nested group deleted.

---

## Phase 8: User Story 6 - Admin manages devices and merchants (Priority: P2)

**Goal**: Admin at root paths `/devices/new` (create + assign org), `/devices` (inventory, disable/enable), `/merchants` (org list with device counts).

**Independent Test**: Create several devices, verify distinct identities + claim codes, assign one to a reseller org, disable one, list merchant orgs (quickstart Scenario 2).

### Tests for User Story 6

- [ ] T030 [P] [US6] Unit tests: admin device create + slug uniqueness + disable/enable in `domains/device/__tests__/`; admin reset scope (clears `organizationId`) in `domains/device/__tests__/` (data-model.md `device.slug`: `unique, lowercase alphanumeric + hyphen, 6–32 chars, never reused`)
- [ ] T031 [P] [US6] E2E: admin create+assign, disable, admin reset in `tests/e2e/admin-devices.spec.ts` (update paths from legacy `app/(admin)/admin/devices/`)

### Implementation for User Story 6

- [ ] T032 [P] [US6] Migrate `app/(admin)/admin/devices/new/page.tsx` → `app/(dashboard)/devices/new/page.tsx` (root `/devices/new`): create + assign to reseller org, shows claim code once, toasts, skeleton; admin-only via `permission` (FR-037)
- [ ] T033 [P] [US6] Migrate `app/(admin)/admin/devices/page.tsx` → `app/(dashboard)/devices/page.tsx` (admin inventory branch): disable/enable, admin reset dialog, toasts
- [ ] T034 [US6] Migrate `app/(admin)/admin/merchants/page.tsx` (and `organizations/page.tsx` if present) → `app/(dashboard)/merchants/page.tsx` (root `/merchants`): org list with device counts; admin-only via `permission`

**Checkpoint**: Admin works at root paths; legacy `app/(admin)/` tree removable (do it in Polish).

---

## Phase 9: User Story 7 - Merchant attaches a Google review destination (Priority: P2)

**Goal**: Google Places search + place selection + derived review URL for a device — used by accountless setup (US1) and dashboard editing (US5).

**Independent Test**: Search a place, select a listing, attach as single-link, verify the generated review link on scan (quickstart Scenario 7/9).

### Tests for User Story 7

- [ ] T035 [P] [US7] Unit tests for `generateReviewUrl(placeId)` deriving `https://search.google.com/local/writereview?placeid=<PLACE_ID>` and `place.placeId` required for `GOOGLE_REVIEW` (data-model.md) in `domains/destination/__tests__/`
- [ ] T036 [P] [US7] Integrate Google Places in existing `domains/destination/server/` tests — `searchPlaces(query)` empty-result → "no results" (US7 AC4)

### Implementation for User Story 7

- [ ] T037 [P] [US7] Reuse the existing destination editor `components/forms/destination-editor.tsx` (single/multi rows, Google Places search, per-type Zod validation) in both `app/(dashboard)/devices/[id]/page.tsx` and `app/(redirect)/[slug]/setup/redirect/`; validate `WEBSITE`/`CUSTOM_URL`/`WHATSAPP` are absolute `http(s)`/`whatsapp://wa.me` URLs; null derived review URL on edit until re-derived (data-model.md)

**Checkpoint**: Google review destination fully functional in both flows.

---

## Phase 10: User Story 8 - Visitor views the marketing homepage (Priority: P2)

**Goal**: Public homepage at `/` in `(landing-page)` — branding, SEO metadata, register/login links, responsive.

**Independent Test**: Open `/` unauthenticated; branding + SEO metadata render; register/login links work (quickstart Scenario 1).

### Tests for User Story 8

- [ ] T038 [P] [US8] E2E: homepage renders branding + register link in `tests/e2e/homepage.spec.ts` (or existing equivalent); assert `robots.txt`/`sitemap.xml` respond

### Implementation for User Story 8

- [ ] T039 [P] [US8] Confirm the marketing page lives in `app/(landing-page)/page.tsx` with `robots.ts` + `sitemap.ts` in the same group; server-rendered with title/description/canonical/OG (FR-019/020); responsive (390px); register/login links intact
- [ ] T040 [P] [US8] Add `next-themes` to `app/(landing-page)/layout.tsx` (sync, no fetch) so the public homepage follows the theme without touching the root layout (FR-034)

**Checkpoint**: Homepage live at root; all stories migrated.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Remove legacy structure, restore the sky-blue + framer-motion design, enforce theme scope, full test sweep.

- [ ] T041 [P] Delete the legacy route groups and any stragglers: `app/(admin)/`, `app/(merchant)/`, `app/analytics`, `app/dashboard`, `app/devices` (verify no imports remain — `npm run typecheck` must stay clean)
- [ ] T042 [P] Apply framer-motion staggered entrance to `app/(auth)/login/page.tsx` + `app/(auth)/register/page.tsx`: card fade-in, form field slide-up with delay stagger, button entrance (client component, `'use client'`); sky-blue gradient background — `from-white via-sky-50/40 to-blue-50/60` light, `from-neutral-950 via-sky-950/10 to-blue-950/20` dark with sky-tinted radial overlays (FR-035); centered on both axes (FR-030); NEVER on any dashboard page
- [ ] T043 [P] Add a light/dark contrast check for the auth gradient and sidebar chrome (FR-032); fix any WCAG AA contrast violations on sky-blue accents
- [ ] T044 [P] Audit theme scope: `next-themes` provider present ONLY in `(auth)`, `(landing-page)`, `(dashboard)` layouts; absent from root `app/layout.tsx` and `(redirect)` (FR-034) — add a unit/type-level check or e2e assertion
- [ ] T045 [P] WCAG AA audit of public surfaces (`/s/[slug]`, setup flow, homepage) and dashboard: keyboard nav, focus states, contrast (US8/SC-007)
- [ ] T046 Run `npm run lint`, `npm run typecheck`, `npm run coverage` (≥90%), `npm run build`, then `npm run test:e2e` against the prod build (`db:migrate` → `db:seed:e2e` → `build` → `next start`, isolated `review_cepat_test` DB) — full green required
- [ ] T047 Confirm quickstart.md Scenarios 1–9 all pass locally on the new structure; fix any scenario drift
- [x] T048 [P] [Clarification 2026-09-16] Add the reusable `DataTable` component at `components/ui/data-table/` mirroring the reference project (`khitan-plus-hipnosis/components/ui/data-table/`): `data-table.tsx` + `data-table-header.tsx` + `data-table-pagination.tsx` + `data-table-skeleton.tsx` + `data-table-view-options.tsx`, built on `@tanstack/react-table` (add the dependency) over the existing `components/ui/table.tsx` primitives; use it for ALL dashboard data views (device lists, members, merchants, organizations, analytics breakdowns) instead of hand-rolled static `Table` markup (FR-038)
- [x] T049 [P] [Clarification 2026-09-16] Extend the `permission` table with `parent_id` (nullable self-reference): schema + migration (`db:generate`/`db:migrate`) + `db/seed/permissions.ts` API-endpoint rows — each permissioned route gets rows with `is_menu=false`, `path` = the endpoint (e.g. `/api/device`), dotted label (e.g. `api.create_device`), `parent_id` = the page row it serves; enforce `can(role, orgRole, path)` in the domain API layer for those endpoints (FR-037)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**:
  - US1 Phase 3, US3 Phase 5: depend only on Foundational (public `(redirect)` surfaces, mostly preserve-only)
  - US2 (Phase 4): depends on Foundational (permission role resolution) — serves both `(auth)` and `(dashboard)`
  - US4 (Phase 6): depends on Foundational shell (T009/T010). US5 (Phase 7) and US6 (Phase 8) depend on US4's migrated shared layout + components but are file-disjoint afterward
  - US7 (Phase 9): depends on US1/US5 destination editor integration, no new routes
  - US8 (Phase 10): independent of all other stories
- **Polish (Phase 11)**: Depends on all stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no cross-story deps
- **US2 (P1)**: After Foundational — shares claim service with US1
- **US3 (P1)**: After Foundational — preserve-only
- **US4 (P2)**: After Foundational
- **US5 (P2)**: After US4 shell; file-disjoint once migrated
- **US6 (P2)**: After US4 shell; file-disjoint
- **US7 (P2)**: After US1 + US5 (shared destination editor)
- **US8 (P2)**: Independent

### Within Each User Story

- Tests first (write/update FEAR-FAIL where new logic), then migration of implementation, then deletion of legacy files
- Migrate pages before deleting legacy groups (T041 must be last-ish)

### Parallel Opportunities

- Setup P-phase (T001–T004) and Foundational (T005–T010) marked [P] where file-disjoint
- US4/US5/US6 pages are file-disjoint within each story ([P])
- US7 + US8 fully parallel to US4–US6 after Foundational
- All test tasks per story are [P]

---

## Parallel Example: User Story 4

```bash
# Launch tests first:
Task: "E2E owner dashboard spec tests/e2e/owner-dashboard.spec.ts (T020)"
Task: "Unit owner-only authorization tests (T021)"

# Launch page migrations together (file-disjoint):
Task: "Migrate dashboard/page.tsx → (dashboard)/dashboard/page.tsx (T022)"
Task: "Migrate members → user-management (T023)"
Task: "Migrate devices/[id]/settings (T024)"
```

---

## Implementation Strategy

### MVP First (US1 + US3 + US8 — no legacy migration risk)

1. Phase 1 + Phase 2 (permission table, seed, proxy, guard, shared shell)
2. Verify US1 (setup), US3 (scan), US8 (homepage) untouched on the new structure
3. **STOP and VALIDATE** — these are preserve-only stories; confirm no regression
4. Deploy/demo if ready

### Incremental Delivery

1. Foundation (Phases 1–2) → permission nav works
2. US1/US3/US8 (preserve + homepage theme) → MVP public surface
3. US2 (claim) → root-path claim works
4. US4 → US5 → US6 (dashboard migrations, biggest UI work)
5. US7 (Google review) → full feature set
6. Polish: delete legacy groups, framer-motion auth, WCAG, full suite

### Parallel Team Strategy

With multiple developers:

1. Setup + Foundational together (T001–T010)
2. Once done:
   - Developer A: US4 dashboard shell + migration
   - Developer B: US7 destination editor
   - Developer C: US8 homepage + US2 claim
3. US5/US6 follow US4 as file-disjoint page migrations
4. Stories integrate through the shared `(dashboard)` shell + `permission` table

---

## Notes

- This tasks.md supersedes the legacy implementation task log (old `(admin)`/`(merchant)` structure); all legacy pages are migrated, not duplicated
- Permission rows are the single source of truth for sidebar nav + endpoint access (FR-036/037) — a page without a matching `permission` row for the role is unreachable
- Migrations must keep `npm run typecheck` green at every checkpoint
- Verification commands: `npm run coverage` (≥90%), `npm run test:e2e`, `npm run build`