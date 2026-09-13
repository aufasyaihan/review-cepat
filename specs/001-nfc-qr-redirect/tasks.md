# Tasks: NFC QR Redirect Platform — Project Foundation

**Input**: Design documents from `/specs/001-nfc-qr-redirect/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests ARE requested — the feature spec Quality Standards (IV) and constitution require node:test unit tests, React Testing Library component tests, Playwright e2e for critical flows, MSW for API mocking, and ≥90% overall coverage. Test tasks are therefore included in every user-story phase (written FIRST, failing before implementation).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5, US6)
- Exact file paths are embedded in every description.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure, matching the canonical directory in `plan.md` and `docs/architecture/NFC_PLATFORM_ARCHITECTURE_v3.md`.

- [ ] T001 Scaffold the canonical monolith directory tree (app/, domains/, components/, db/, lib/, providers/, hooks/, tests/, drizzle/, scripts/, .github/) at repo root, with placeholder index files so all paths resolve
- [ ] T002 [P] Create package.json with Next.js 16 / React 19 / TypeScript and the pinned stack (drizzle-orm, mysql2, drizzle-kit, better-auth, @better-auth/drizzle-adapter, @tanstack/react-query, @tanstack/react-form, zod, pino, @biomejs/biome, @testing-library, playwright, msw) as dependencies
- [ ] T003 [P] Configure Biome in biome.json as the single lint+format tool with npm scripts lint, format, typecheck, test, coverage, build, db:generate, db:migrate, db:seed in package.json
- [ ] T004 [P] Configure TypeScript strict mode (strict, verbatimModuleSyntax, moduleResolution bundler) in tsconfig.json so `npm run typecheck` passes on an empty skeleton
- [ ] T005 [P] Configure drizzle.config.ts with dialect mysql, schema pointing at db/schema, migration output to ./drizzle per plan.md mapping
- [ ] T006 [P] Create .env.example (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_PLACES_API_KEY) and a .env loader contract — secrets are never committed (constitution VII)
- [ ] T007 Create .github/workflows/ci.yml running on push to main/develop and PRs: actions/checkout@v4, actions/setup-node@v4 node 22 cache npm, then npm ci, npm run lint, npm run typecheck, npm run test, npm run coverage (gate ≥90%), npm run build
- [ ] T008 Create scripts/deploy.sh exactly per architecture doc: ssh "$USER@$SERVER" → cd $APP_DIR, git fetch origin, git checkout $BRANCH, git reset --hard origin/$BRANCH, npm install, npm run db:migrate, npm run build, pm2 restart nfc-platform || pm2 start npm --name nfc-platform -- start, pm2 save; requires env SERVER/USER/APP_DIR/BRANCH

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T009 [P] Define all Drizzle schema modules in db/schema/: user (role 'ADMIN'|'MERCHANT', status 'ACTIVE'|'DEACTIVATED'), merchant_profile (businessName required ≤120 chars; country ISO-3166 alpha-2), device (slug unique lowercase alphanumeric+hyphen 6–32 immutable; status UNCLAIMED|CLAIMED|PUBLISHED|UNPUBLISHED|DISABLED; ownerId FK; claimCodeHash unique salted hash), destination (type GOOGLE_REVIEW|INSTAGRAM|FACEBOOK|TIKTOK|WHATSAPP|WEBSITE|CUSTOM_URL; position unique per device; active bool), place (googlePlaceId unique), scan_event (outcome REDIRECTED|LANDING_SHOWN|INACTIVE|NOT_FOUND; ipHash; createdAt), per data-model.md with db/relations.ts and db/index.ts
- [ ] T010 [P] Generate initial Drizzle migration to ./drizzle via `npm run db:generate` and create db/seed.ts seeding one ADMIN user and one example UNCLAIMED device for local validation
- [ ] T011 [P] Set up Pino as the sole logger in lib/logger.ts with a request helper (request id, method, path, status, durationMs, actor, device slug) invoked by every Route Handler and services, plus instrumentation.ts register() hook for startup/error context (constitution VI — errors logged with context)
- [ ] T012 [P] Configure Better Auth server in lib/auth.ts (Drizzle adapter provider mysql, BETTER_AUTH_SECRET) with role claim, mounted in app/api/auth/[...all]/route.ts via toNextJsHandler; auth client in providers/ from better-auth/react per contracts/domain-api.md
- [ ] T013 [P] Set up TanStack Query infrastructure: lib/query-client.ts (getQueryClient + dehydrate), providers/ root provider (auth client + QueryClientProvider), and app/layout.tsx + providers.tsx rendering the Phantom UI shell (sync layout, no data fetching — constitution II)
- [ ] T014 [P] Create app/error.tsx, app/not-found.tsx, and app/loading.tsx with accessible error/empty states (constitution IV) using shadcn/ui + Phantom UI layout components in components/layout/
- [ ] T015 [P] Implement the RBAC base: role-guard util + one skeleton domains/*/server/permissions.ts per domain (auth, merchant, device, destination, scan, analytics) enforcing ADMIN/MERCHANT from the role claim (constitution VII)
- [ ] T016 [P] Configure the test harness: node:test runner with built-in coverage (≥90% gate) in npm run coverage, MSW handlers directory tests/msw/, Playwright config tests/ as per architecture Testing section

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Merchant claims and configures a device (Priority: P1) 🎯 first slice

**Goal**: A registered merchant claims a purchased device with a claim code, configures a single-link or multi-link destination, and publishes so it is `<device.slug>`-resolvable.

**Independent Test**: Register a merchant → claim a device with a valid claim code → attach a single destination URL → publish → device status shows PUBLISHED; an invalid/used claim code shows a clear error and changes nothing.

### Tests for User Story 1 ⚠️ (write first, verify FAIL)

- [ ] T017 [P] [US1] Unit + component tests for merchant registration (businessName required ≤120 chars, country ISO-3166 alpha-2, claim invalid/used-code rejection) in domains/merchant/__tests__/ and domains/device/__tests__/ via node:test + RTL
- [ ] T018 [P] [US1] Playwright e2e happy path (register → claim → configure single link → publish) in tests/e2e/merchant-claim.spec.ts

### Implementation for User Story 1

- [ ] T019 [P] [US1] Create merchant Zod schemas (registration: businessName required ≤120 chars; email unique well-formed; country ISO-3166 alpha-2; role implicit MERCHANT) in domains/merchant/schemas/
- [ ] T020 [P] [US1] Create device claim + destination Zod schemas (claimCode single-use; destination url required absolute http(s)/whatsapp://wa.me for WEBSITE/CUSTOM_URL/WHATSAPP; position unique contiguous from 0; at least one active destination before PUBLISHED) in domains/device/schemas/ and domains/destination/schemas/
- [ ] T021 [US1] Implement merchant domain server (service/repository/mapper/permissions) + api layer (client/queries/mutations) in domains/merchant/ for register + profile, with Route Handler translation only in app/api/merchant/...
- [ ] T022 [US1] Implement device domain merchant ops in domains/device/: claim(claimCode) with salted-hash verification and status UNCLAIMED→CLAIMED, listOwned, get, publish (gate: ≥1 active destination), unpublish, transfer(id, toMerchantId) preserving status
- [ ] T023 [US1] Implement destination domain setForDevice(deviceId, destinations[]) atomic single/multi-link replace in domains/destination/server/, validated by domains/destination/schemas/
- [ ] T024 [US1] Build merchant UI with TanStack Form + Zod + shadcn/ui/Base UI: app/(auth)/register/page.tsx, app/(merchant)/dashboard/page.tsx, app/(merchant)/devices/page.tsx, app/(merchant)/devices/claim/page.tsx, app/(merchant)/devices/[id]/page.tsx (config + publish/unpublish) with loading.tsx/error.tsx and empty states
- [ ] T025 [US1] Wire TanStack SSR prefetch + HydrationBoundary on every US1 page (getQueryClient + prefetchQuery(merchantQueries/deviceQueries) server-side) per plan.md TanStack pattern

**Checkpoint**: US1 fully functional — merchant can register, claim, configure, and publish independently.

---

## Phase 4: User Story 2 - Customer scans a device and reaches its destination (Priority: P1) 🎯 second slice

**Goal**: A customer opens `/s/<slug>` and either gets a server-side redirect to the single destination or a server-rendered multi-link landing page; every scan is recorded once, server-side, before the response.

**Independent Test**: Open `/s/<slug>` of a published single-link device → 3xx redirect with no intermediate page and a scan_event with outcome REDIRECTED; multi-link device → landing page listing links with outcome LANDING_SHOWN; unpublished/disabled → inactive message outcome INACTIVE; unknown slug → 404.

### Tests for User Story 2 ⚠️ (write first, verify FAIL)

- [ ] T026 [P] [US2] Unit tests for scan resolution logic (single→redirect, multi→landing, inactive, not_found; recording exactly once server-side) in domains/scan/__tests__/
- [ ] T027 [P] [US2] Playwright e2e scan flows in tests/e2e/public-scan.spec.ts covering redirect, landing page, inactive, and 404

### Implementation for User Story 2

- [ ] T028 [P] [US2] Implement scan domain: repository/service recording scan_event (outcome REDIRECTED|LANDING_SHOWN|INACTIVE|NOT_FOUND, browser/deviceType parsed from UA, referrer ≤300 chars, country/city best-effort, ipHash one-way, createdAt UTC) in domains/scan/server/
- [ ] T029 [US2] Implement app/s/[slug]/page.tsx per contracts/public-scan.md: single-link records then redirect() server-side; multi-link TanStack prefetch + HydrationBoundary landing page (server-rendered, SEO metadata, links in position order); inactive states never forward (depends on T028)
- [ ] T030 [US2] Add app/s/[slug]/loading.tsx and the landing page UI (Phantom UI shell, WCAG AA, mobile-first) in app/s/[slug]/ using domain scan/destination components
- [ ] T031 [US2] Add structured Pino request log (request id, path /s/<slug>, outcome, durationMs) for the scan route via lib/logger.ts

**Checkpoint**: US1 AND US2 together form the walkable MVP (create → claim/configure → scan → redirect + recorded).

---

## Phase 5: User Story 3 - Admin manages devices and merchants (Priority: P2)

**Goal**: Admin logs in, creates devices (unique slug + one-time claim code per device), disables/enables, and views merchants.

**Independent Test**: Admin creates a device → distinct slug and a one-time claim code shown once (only a salted hash stored); disabling it → device no longer scan-resolves; merchants list shows merchants with their devices.

### Tests for User Story 3 ⚠️ (write first, verify FAIL)

- [ ] T032 [P] [US3] Unit tests for admin device ops (unique slug lowercase alphanumeric+hyphen 6–32, claimCodeHash salted never plaintext, disable→DISABLED, enable→CLAIMED, transfer preserves status) in domains/device/__tests__/admin
- [ ] T033 [P] [US3] Playwright e2e admin flow in tests/e2e/admin-devices.spec.ts (create device, verify one-time code, disable, verify merchant list)

### Implementation for User Story 3

- [ ] T034 [P] [US3] Implement admin device ops in domains/device/server/: create() (slug + one-time claimCodeHash), listAll, disable(id), enable(id) with ADMIN permission checks in domains/device/server/permissions.ts
- [ ] T035 [P] [US3] Build admin UI with TanStack prefetch + Phantom UI shell: app/(admin)/dashboard/page.tsx, app/(admin)/devices/page.tsx, app/(admin)/devices/new/page.tsx, app/(admin)/merchants/page.tsx, plus app/(admin)/layout.tsx (sync, no fetch) and loading/error states
- [ ] T036 [US3] Implement admin merchant list (listMerchants with per-merchant device counts) in domains/merchant/server/service.ts + api layer, exposed via a translation-only Route Handler

**Checkpoint**: Admin inventory management works independently alongside US1/US2.

---

## Phase 6: User Story 4 - Merchant views scan analytics (Priority: P2)

**Goal**: Merchant sees total scans, daily scans, per-device counts, browser/device type, country/city, referrer, and timestamps.

**Independent Test**: After generating scans from different browsers/days, merchant analytics shows matching totals, daily counts, per-device counts, and breakdowns; scans without geo data show location unavailable (never error).

### Tests for User Story 4 ⚠️ (write first, verify FAIL)

- [ ] T037 [P] [US4] Unit tests for analytics aggregation (totals, daily, per-device, browser/deviceType/country/city/referrer breakdown; geo-absent tolerated) in domains/analytics/__tests__/
- [ ] T038 [P] [US4] Playwright e2e in tests/e2e/analytics.spec.ts (create scans → verify dashboard counts match)

### Implementation for User Story 4

- [ ] T039 [P] [US4] Implement analytics domain queries in domains/analytics/server/service.ts using the (deviceId, createdAt) composite index: overview(merchantId) and breakdown(deviceId, dimension), with schemas/types
- [ ] T040 [US4] Build analytics UI in app/(merchant)/analytics/page.tsx (TanStack prefetch + HydrationBoundary, aggregate cards, breakdown tables, empty state for zero scans)

**Checkpoint**: Analytics works against real scan events from US2.

---

## Phase 7: User Story 5 - Merchant attaches a Google review destination (Priority: P2)

**Goal**: Merchant searches a business via Google Places, selects it, and attaches a GOOGLE_REVIEW destination whose review URL is derived automatically.

**Independent Test**: Search a place → results shown → select → destination saved with reviewUrl derived as https://search.google.com/local/writereview?placeid=<PLACE_ID>; a scan of that device lands on the business's review page; no-result search shows a clear message.

### Tests for User Story 5 ⚠️ (write first, verify FAIL)

- [ ] T041 [P] [US5] Unit tests for place search + review URL derivation (googlePlaceId unique; URL derived server-side, never client) in domains/destination/__tests__/
- [ ] T042 [P] [US5] Playwright e2e Google-review flow in tests/e2e/google-review.spec.ts (search → select → attach → publish → scan lands on review page)

### Implementation for User Story 5

- [ ] T043 [P] [US5] Implement Google Places server-side adapter in domains/destination/server/place.ts (search places, store googlePlaceId/name/formattedAddress; API credential used server-side only), plus place schema in domains/destination/schemas/
- [ ] T044 [US5] Extend destination config UI in app/(merchant)/devices/[id]/page.tsx with place search + select and GOOGLE_REVIEW destination cards showing the derived review URL (depends on T043)

**Checkpoint**: Google review destinations work alongside the rest of destination config.

---

## Phase 8: User Story 6 - Visitor views the marketing homepage (Priority: P2)

**Goal**: A single public marketing homepage at `/` presenting branding, SEO-ready (server-rendered title/description/canonical/Open Graph), responsive, with register/login links (per Clarifications session 2026-09-13 and FR-018/FR-019).

**Independent Test**: Open `/` logged out → branding page renders on mobile and desktop; page source shows title, description, canonical, and Open Graph metadata; robots.txt and sitemap.xml exist listing public pages; register link reaches /register.

### Tests for User Story 6 ⚠️ (write first, verify FAIL)

- [ ] T045 [P] [US6] Playwright e2e + component tests for the homepage in tests/e2e/homepage.spec.ts (branding content, SEO metadata, robots.txt, sitemap.xml, register link, responsive render)

### Implementation for User Story 6

- [ ] T046 [P] [US6] Build app/page.tsx marketing homepage (server-rendered branding sections, shadcn/ui + Phantom UI shell, WCAG AA, responsive) with metadata export (title, description, canonical, Open Graph) per FR-019
- [ ] T047 [US6] Create app/robots.ts and app/sitemap.ts exposing directives and a sitemap for public pages (homepage; public device landing pages)

**Checkpoint**: Marketing homepage ships as the SEO-ready public face.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories; gates from the constitution.

- [ ] T048 [P] Run every scenario in quickstart.md (homepage, admin create, merchant claim/config/publish, single-link scan, multi-link scan, inactive states, analytics) end-to-end and fix failures
- [ ] T049 [P] WCAG AA audit pass on all pages (marketing homepage, landing page, merchant/admin areas) including keyboard navigation and focus states
- [ ] T050 [P] Performance check: scan→destination <2s and homepage <2s on a standard mobile connection (SC-001, SC-007) with tachometer/devtools profiling
- [ ] T051 [P] Security hardening pass: confirm no secrets committed, no Google Places key on the client, Zod validation at every input boundary, and document the scan endpoint's rate/abuse surface
- [ ] T052 Verify final gate: `npm run coverage` ≥90%, `npm run lint`, `npm run typecheck`, and `npx playwright test` all green, and update .github/workflows/ci.yml if gaps found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational completion; run in priority order
- **Polish (Phase 9)**: Depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational — functionally depends on US1-configured PUBLISHED devices for the happy path, but its resolution logic is testable independently (T026/T027 seed fixtures)
- **US3 (P2)**: After Foundational — independent (admin creates the inventory US1 claims)
- **US4 (P2)**: After Foundational + US2 (analytics consumes scan_event rows)
- **US5 (P2)**: After Foundational + US1 config UI (attaches GOOGLE_REVIEW destinations)
- **US6 (P2)**: After Foundational — fully independent

### Within Each User Story

1. Tests (included — mandated by spec/constitution) MUST be written and FAIL before implementation
2. Schemas/models before services; services before endpoints; core implementation before integration
3. Story complete (checkpoint green) before moving to next priority

### Parallel Opportunities

- All [P] tasks within a phase/story can run in parallel (different files, no shared state)
- Phase 1 [P] tasks (T002–T006) run in parallel after T001
- Phase 2 [P] tasks (T009–T016) run in parallel after Setup
- Tests within a story run in parallel before implementation
- After Foundational, US3, US5, and US6 can proceed in parallel with US1/US2 (team capacity permitting)

---

## Parallel Example: User Story 1

```bash
# Write failing tests together:
Task: "Unit + component tests for merchant registration/claim/config in domains/merchant/__tests__/ and domains/device/__tests__/"
Task: "Playwright e2e happy path in tests/e2e/merchant-claim.spec.ts"

# Then launch schemas in parallel:
Task: "Merchant Zod schemas in domains/merchant/schemas/"
Task: "Device claim + destination Zod schemas in domains/device/schemas/ and domains/destination/schemas/"

# Then domains in parallel:
Task: "Merchant domain server + api layer in domains/merchant/"
Task: "Device domain merchant ops in domains/device/"
Task: "Destination setForDevice in domains/destination/"
```

---

## Implementation Strategy

### MVP First (walkable product)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 (merchant claim/configure/publish) → validate independently
4. Complete Phase 4: US2 (public scan redirect/landing + recording) → **this is the core MVP**: an admin can create a device, a merchant can claim/configure/publish, and a customer scan reaches the destination with analytics recorded (spec SC-006)
5. STOP and VALIDATE with quickstart scenarios 2–6 before adding P2 stories
6. Add P2 stories incrementally (US3 → US4 → US5 → US6), each independently testable

### Incremental Delivery

- Setup + Foundational → foundation ready
- US1 → test independently → deploy/demo
- US2 → test independently → deploy/demo (MVP!)
- US3 → US4 → US5 → US6, each tested and deployable on its own

### Parallel Team Strategy

- Team completes Setup + Foundational together
- Developer A: US1 → US2 (scan loop, the MVP)
- Developer B: US3 (admin) and US6 (homepage)
- Developer C: US5 (Google reviews) then US4 (analytics)
- Stories integrate independently; nobody touches another developer's domains

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps a task to its user story for traceability
- Entity/constraint wording (max lengths, enums, unique rules, status transitions) is quoted verbatim from data-model.md — do not change constraints at implementation time
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at each checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence