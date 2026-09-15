# Quickstart — Validation Guide

Runnable end-to-end validation for the NFC QR Redirect MVP. Contract details in
[contracts/](contracts/) and data rules in [data-model.md](data-model.md); this file
only tells you how to prove the feature works.

## Prerequisites

- Node.js 22 LTS, npm
- MySQL 8.x reachable, `mysql://` connection string
- Google Places API credential (server-side only)
- Env configured from `.env.example`: DB, auth secret, Places key

## Setup

```bash
npm ci
npm run db:generate        # squash schema -> migrations (already committed; idempotent)
npm run db:migrate         # apply migrations to MySQL
npm run db:seed            # create an ADMIN account + example unclaimed device
npm run dev                # start app (http://localhost:3000)
```

CI runs: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run coverage`
(≥90%), `npm run build`. E2E: `npx playwright test`.

## Validation scenarios

### Scenario 1 — Homepage (branding + SEO)

1. Open `http://localhost:3000/` logged out.
2. **Expect**: branding/landing page renders responsively (check at 390px width);
   page source contains `title`, `description`, canonical, and Open Graph metadata;
   `robots.txt` and `sitemap.xml` exist and list public pages; register link leads to
   `/register`.

### Scenario 2 — Admin creates a device

1. Log in as ADMIN, go to devices → new.
2. **Expect**: device appears in inventory with a unique `slug` and a one-time claim
   code (code shown once, never stored plaintext).

### Scenario 3 — Merchant claims + configures + publishes

1. Register a MERCHANT, open claim and enter the device's claim code.
2. **Expect**: device is owned; editing destinations accepts a single link, a multi
   link set, and a Google review flow:
   - search a place → results shown → select → review URL generated automatically.
3. Publish.
4. **Expect**: status `PUBLISHED`; an invalid/foreign claim code shows a clear error
   and changes nothing.

### Scenario 4 — Public scan: single link

1. Open `http://localhost:3000/s/<slug>` of the single-link published device.
2. **Expect**: 3xx redirect straight to the destination (devtools: no intermediate
   page); a `scan_event` with `outcome = REDIRECTED` exists with browser/device
   populated; referrer captured when present.

### Scenario 5 — Public scan: multi link

1. Open `http://localhost:3000/s/<slug>` of a multi-link published device.
2. **Expect**: server-rendered landing page listing all active links in order;
   `scan_event` with `outcome = LANDING_SHOWN`; each link navigable; page is WCAG AA
   (tab through links) and responsive.

### Scenario 6 — Inactive states

For devices that are UNCLAIMED, CLAIMED-but-not-published, UNPUBLISHED, or DISABLED:
1. Open `/s/<slug>`.
2. **Expect**: inactive message page (HTTP 200, never forwarded), `outcome = INACTIVE`.
3. For an unknown slug: **Expect** 404.

### Scenario 7 — Merchant analytics

1. Generate scans across days with different browsers.
2. Open merchant analytics.
3. **Expect**: total scans, daily counts, per-device counts, browser/device/country/
   city/referrer breakdowns match; scans with no geo data show location unavailable
   without erroring.

### Playwright coverage

- Happy path: admin → merchant → scan → analytics (scenarios 2–5, 7).
- Failure paths: invalid claim (3), inactive scan (6).

## Done when

Scenarios 1–7 pass locally with `npm run coverage` ≥ 90% and `npx playwright test`
green — this is the same suite CI runs on push/PR.