# Quickstart — Validation Guide

Runnable end-to-end validation for the NFC QR Redirect MVP (organization model +
accountless setup). Contract details in [contracts/](contracts/) and data rules in
[data-model.md](data-model.md); this file only tells you how to prove the feature works.

## Prerequisites

- Node.js 22 LTS, npm
- MySQL 8.x reachable, `mysql://` connection string
- Google Places API credential (server-side only)
- Env configured from `.env.example`: DB, auth secret (including organization plugin
  env, e.g. `BETTER_AUTH_SECRET`), Places key

## Setup

```bash
npm ci
npx @better-auth/cli migrate        # org plugin tables (organization/member/invitation)
npm run db:generate                 # squash schema -> migrations (already committed)
npm run db:migrate                  # apply migrations to MySQL
npm run db:seed                     # ADMIN + reseller org (owner) + sub-merchant + devices
                                    # + permission table rows (FR-037, sidebar/nav for all roles)
npm run dev                         # start app (http://localhost:3000)
```

One-time UI setup (per spec FR-029/033/034):

```bash
npx shadcn@latest init --base-color sky   # shadcn on Base UI primitives, sky primary
npx shadcn@latest add sidebar toast skeleton ...
npx @aejkatappaja/phantom-ui init         # SSR pre-hydration CSS + JSX types
npm i next-themes framer-motion           # auth page animations + theme
```

CI runs: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run coverage`
(Vitest, ≥90%), `npm run build`. E2E: `npx playwright test`.

## Validation scenarios

### Scenario 1 — Homepage (branding + SEO)

1. Open `http://localhost:3000/` logged out.
2. **Expect**: branding/landing page renders responsively (390px); source contains
   title, description, canonical, Open Graph; `robots.txt`/`sitemap.xml` exist; register
   link leads to `/register`.

### Scenario 2 — Admin creates a device and binds it to a reseller org

1. Log in as ADMIN (sidebar shell, toasts on every action — both expect to fire).
2. Devices → new; create a device and **assign it to the reseller organization**.
3. **Expect**: device appears with a unique `slug` and a one-time-visible claim code
   (hash-only stored); `organizationId` bound on the row.

### Scenario 3 — Accountless setup: scan → claim code → redirect type (FR-004)

1. Open `http://localhost:3000/<slug>/setup` logged out — no account, no login wall.
2. Enter the device's claim code → forwarded to `/<slug>/setup/redirect`.
3. Choose **single-link**: search a Google Place, select it, submit.
4. **Expect**: device status `CLAIMED` with a `GOOGLE_REVIEW` destination; success
   toast; no `boundUserId` yet. Skeleton loading appeared during navigation
   (`loading.tsx`/Suspense + phantom-ui).

### Scenario 4 — Public scan: single link

1. Publish the device, open `/s/<slug>`.
2. **Expect**: 3xx redirect straight to the derived review URL; a `scan_event` with
   `outcome = REDIRECTED`, browser/device populated, referrer when present.

### Scenario 5 — Public scan: multi link + inactive

1. Set up a second device with multiple links → `/s/<slug>` shows the landing page
   listing links in `position` order (`LANDING_SHOWN`); WCAG AA (tab through).
2. Unclaim/disable/unpublish a device → `/s/<slug>` returns an inactive message (200,
   never forwarded), `outcome = INACTIVE`. Unknown slug → 404.

### Scenario 6 — Sub-merchant registers with a claim code (FR-024)

1. Register a brand-new user using the setup device's claim code.
2. **Expect**: account created; user auto-joined the reseller org as `member`;
   `device.boundUserId` set; device visible on the sub-merchant's dashboard.
3. Try reusing the code to register another account → rejected ("already linked").

### Scenario 7 — Reseller dashboard: analytics + member management + reset (FR-021/022)

1. Log in as the owner. **Expect**: sees all org devices (including the sub-merchant's);
   `/dashboard` includes the analytics section (totals, daily, per-device,
   browser/device/country/city/referrer — owner only); `/user-management` shows members
   with roles and assigned devices. Sidebar nav is rendered from the `permission` table —
   Owner sees Dashboard/Devices/User management/Settings (FR-037). Auth pages and
   dashboards are sidebar + next-themes themed; dark mode toggle works (FR-034).
2. Owner **resets** the sub-merchant's device → destinations cleared, org KEPT, fresh
   claim code, re-setup required.
3. **Admin resets** the same device → `organizationId` also cleared (unclaimed/admin-
   owned), fresh claim code.

### Scenario 8 — Sub-merchant isolation (SC-008)

1. As the sub-merchant, open dashboard. **Expect**: only assigned devices listed;
   `/user-management` is not accessible (redirect/denied via `permission` table — Member
   has no row for it); analytics section absent from `/dashboard`.
   Sidebar shows Dashboard/Devices/Settings only (FR-037).

### Scenario 9 — Dashboard claim with login-or-register (FR-005)

1. Logged in as the owner, claim a second device via claim code from the dashboard.
2. **Expect**: device added to the reseller's org without a separate login step (toast).

## Playwright coverage

- Happy path: admin create+bind → accountless setup → scan → owner analytics
  (scenarios 2–4, 7).
- Org flows: sub-merchant register-with-code, isolation, reset scopes, multi-path
  claim (scenarios 5–9).

## Done when

Scenarios 1–9 pass locally with `npm run coverage` ≥ 90% and `npx playwright test`
green — the same suite CI runs on push/PR.