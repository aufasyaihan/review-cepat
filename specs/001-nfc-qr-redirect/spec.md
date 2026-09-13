# Feature Specification: NFC QR Redirect Platform

**Feature Branch**: `001-nfc-qr-redirect`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Build an NFC and QR Redirect SaaS platform where merchants can activate physical NFC devices and QR codes, configure destinations, and collect scan analytics. Create a production-ready SaaS that allows businesses to redirect customers to Google Reviews or multiple social links through NFC tags or QR codes."

## Clarifications

### Session 2026-09-13

- Q: What should the new "(landing-page) layout" cover exactly? → A: A single public marketing homepage at the site root (/), serving as the branding and SEO-ready page; no separate marketing layout group and no additional marketing pages in the MVP.
- Q: Which framework should run the unit tests? → A: Vitest — bun and the Node.js Test Runner are not used in this project; unit tests run under Vitest with the 90% coverage gate unchanged. (Deviation from constitution V allowed by direct instruction.)
- Q: What shape should the API client take? → A: A class/object-based builder client — `api.get(path).setHeader(...).setBody(...).send()`, plus `post`, `put`, `delete`; all domain HTTP calls route through it.
- Q: How should the public/authenticated boundary be enforced? → A: A Next.js 16 `proxy.ts` (the middleware rename) handles the Better Auth session — unauthenticated users hitting protected areas are redirected before rendering.
- Q: What git pre-commit workflow should apply? → A: Husky pre-commit runs lint-staged (formatting/lint) and unit-test coverage before every commit; the lint-staged command is declared in package.json.
- Q: How should the app routes be organized? → A: Route groups per domain — `(auth)`, `(admin)`, `(merchant)` with a nested `(sub-merchant)` group, `(landing-page)` for the public marketing homepage, and `(redirect)` for `/s/[slug]` — each group gets its own layout with an error catch, plus a global `[...catch]` catch-all route.
- Q: What cookie prefix should Better Auth use? → A: `auth` (session cookie becomes `auth.session_token`); the Next.js 16 `proxy.ts` resolves the session via `auth.api.getSession`.
- Q: How should e2e run the app? → A: Always a production build — the e2e server runs `db:migrate` → `db:seed:e2e` → `build` → `next start` against the isolated `review_cepat_test` database (never the dev server).
- Q: Where must mutations and forms live? → A: Every `page.tsx` is a Server Component. All data mutations go through Server Actions (`'use server'`), never fetch-based route-handler mutations; every form is handled by TanStack Form submitting to a Server Action, and every mutation revalidates the affected TanStack Query cache keys on success.
- Q: What happens after login? → A: Sign-in redirects to the correct area by role — admins land on `/admin`, merchants on `/dashboard` — after a successful Server Action sign-in; every action shows a toast (login, create device, etc.). The app header is not part of the root layout.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Merchant claims and configures a device (Priority: P1)

After registering an account, a merchant claims a physical NFC/QR device they purchased, configures its destination — either a single link (e.g. Google Reviews) or a multi-link page of social and website links — and publishes it so customers can scan it. The merchant can unpublish the device at any time.

**Why this priority**: Configuration is what gives a device meaning. Until a merchant claims and configures a device, no customer can be redirected, so this journey unlocks every downstream value.

**Independent Test**: Can be fully tested by registering a merchant, claiming a device with a valid claim code, attaching destinations, publishing, and observing the device act as active — delivers the setup experience without any admin or analytics UI.

**Acceptance Scenarios**:

1. **Given** a registered merchant and an unclaimed device, **When** the merchant enters a valid claim code, **Then** the device becomes owned by the merchant.
2. **Given** a claimed device with no destinations, **When** the merchant attaches a single destination URL and publishes, **Then** the device status is "published" and shows the configured destination.
3. **Given** a published device, **When** the merchant unpublishes it, **Then** the device status changes to "unpublished" and it no longer resolves for customers.
4. **Given** a merchant entering a claim code already used or invalid, **When** submission is attempted, **Then** a clear error is shown and no ownership change occurs.
5. **Given** a published device, **When** the merchant edits its destinations, **Then** the new configuration takes effect for future scans.

---

### User Story 2 - Customer scans a device and reaches its destination (Priority: P1)

A customer taps an NFC device with their phone or scans its QR code. For a single-link device they are redirected immediately to the destination; for a multi-link device they see a public landing page listing all links. Every scan is recorded automatically before the customer proceeds.

**Why this priority**: This is the core promise of the product — customers reach the intended destination (e.g. a Google review form) with zero friction. It delivers the value merchants pay for.

**Independent Test**: Can be fully tested by scanning a seeded published single-link device and verifying an immediate redirect to the destination, then scanning a multi-link device and verifying the landing page — delivers the redirect experience without any admin or analytics UI.

**Acceptance Scenarios**:

1. **Given** a published device configured with a single destination, **When** a customer scans it, **Then** the customer is forwarded to the destination without an intermediate page.
2. **Given** a published device configured with multiple destinations, **When** a customer scans it, **Then** the customer sees a page listing all links and can open any of them.
3. **Given** a published device, **When** a customer scans it, **Then** a scan event is recorded (outcome, source, timestamp) before the customer is redirected.
4. **Given** an unpublished or disabled device, **When** a customer scans it, **Then** the customer sees a clear inactive message instead of a redirect.

---

### User Story 3 - Admin manages devices and merchants (Priority: P2)

An admin logs in, creates devices (generating a unique identity and claim code for each), manages the inventory, publishes or disables devices, and views merchant accounts.

**Why this priority**: It carries no customer-facing value by itself, but it produces the inventory merchants depend on, so it follows the two P1 journeys.

**Independent Test**: Can be fully tested by creating several devices, verifying each gets a distinct identity, disabling one, and listing the merchant accounts — delivers inventory management without customer-facing features.

**Acceptance Scenarios**:

1. **Given** a logged-in admin, **When** the admin creates a device, **Then** a unique device identity and a claim code are generated.
2. **Given** two devices created at the same time, **When** compared, **Then** their identities are distinct.
3. **Given** a device inventory list, **When** the admin disables a device, **Then** it is marked disabled and cannot be scanned to a destination.
4. **Given** an administered platform, **When** the admin opens the merchants view, **Then** a list of registered merchants and their devices is shown.

---

### User Story 4 - Merchant views scan analytics (Priority: P2)

A merchant opens their analytics view and sees metrics for their devices: total scans, scans per day, per-device scans, browser/device type, country/city when available, referrer, and the latest scan times.

**Why this priority**: Analytics is a stated core feature that drives merchant adoption, but destinations work without it, so it ranks below the redirect journeys.

**Independent Test**: Can be fully tested by scanning a device several times from different browsers and verifying the counts and breakdowns appear in the merchant view.

**Acceptance Scenarios**:

1. **Given** a merchant with scanned devices, **When** the analytics view is opened, **Then** total scans and per-device scan counts are displayed.
2. **Given** scans occurring on different days, **When** the daily view is opened, **Then** scan counts are grouped by day.
3. **Given** a scan with known browser, device, country, city, and referrer data, **When** its details are shown, **Then** each attribute is displayed when available.
4. **Given** a scan with no location data available, **When** its details are shown, **Then** the location is shown as unavailable without failing.

---

### User Story 5 - Merchant attaches a Google review destination (Priority: P2)

A merchant searches for a business via Google Places, selects the matching listing, and attaches it to a device. The review destination is stored by business reference and the review link is generated automatically so customers can be directed straight to that business's reviews.

**Why this priority**: Google reviews are the primary redirect use case in the product brief and automate a common merchant task, but the redirect engine works with plain URLs too.

**Independent Test**: Can be fully tested by searching a place, selecting a listing, attaching it as a single-link destination, and verifying the generated review link opens the listing's reviews for a customer scan.

**Acceptance Scenarios**:

1. **Given** a merchant on the destination setup screen, **When** the merchant searches for a business, **Then** a list of matching businesses is shown.
2. **Given** search results displayed, **When** the merchant selects one, **Then** the selection becomes a review destination on the device.
3. **Given** a review destination attached, **When** a customer scans the device, **Then** they are sent to that business's review page.
4. **Given** a search with no matches, **When** the merchant submits it, **Then** a clear "no results" message is shown and the merchant can search again.

---

### User Story 6 - Visitor views the marketing homepage (Priority: P2)

A first-time visitor opens the platform's public homepage and immediately understands what the platform does from its branding content, can be found via search engines, and can reach merchant registration or login from the page.

**Why this priority**: It is the public face and SEO entry point of the product, but the core claim/configure/scan value works without it.

**Independent Test**: Can be fully tested by opening the site root unauthenticated, verifying branding content and SEO metadata render, and confirming the register/login links work — delivers the marketing presence without any scan or device flow.

**Acceptance Scenarios**:

1. **Given** a visitor who is not logged in, **When** they open the site root, **Then** a branding page is shown describing the product.
2. **Given** a visitor on the homepage, **When** they inspect the page metadata, **Then** the page exposes SEO metadata (title, description, canonical, Open Graph) and is server-rendered.
3. **Given** a visitor on the homepage, **When** they follow the register link, **Then** they reach the merchant registration flow.
4. **Given** a mobile visitor, **When** the homepage is opened, **Then** it renders responsively.

---

### Edge Cases

- Invalid, expired, or already-claimed claim codes at device claim time.
- Scanning a device that is unpublished, disabled, or not yet claimed.
- Scanning a device with no configured destination.
- Unknown or malformed device identity in a scan request.
- Scan requests with missing browser, location, or referrer data.
- Repeated/concurrent scans of the same device within a short window.
- A merchant transferring a device to another merchant account.
- Google Places searches returning no matches or the merchant choosing none.
- A single-link destination URL that is invalid or unreachable at configuration time.
- A device whose merchant account is deactivated while the device is published.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow merchants to register an account.
- **FR-002**: The system MUST allow admins to log in with elevated privileges.
- **FR-003**: The system MUST allow admins to create devices and MUST generate a unique device identity and a claim code for each device.
- **FR-004**: The system MUST allow a merchant to claim a device using a valid claim code and MUST reject invalid, expired, or already-used codes with a clear message.
- **FR-005**: The system MUST allow a merchant to configure a device with a single destination link or multiple destination links.
- **FR-006**: The system MUST support these destination types: Google review, Instagram, Facebook, TikTok, WhatsApp, website, and custom URL.
- **FR-007**: The system MUST allow a merchant to publish and unpublish their devices at any time.
- **FR-008**: The system MUST allow a device to be activated, disabled, or transferred to another merchant account.
- **FR-009**: The system MUST allow a merchant to search businesses via Google Places, select a listing, store its reference, and generate the review link automatically.
- **FR-010**: When a customer scans a device configured with a single link, the system MUST forward them to the destination immediately.
- **FR-011**: When a customer scans a device configured with multiple links, the system MUST show a public landing page listing all links.
- **FR-012**: The system MUST record a scan event, including outcome, source, and timestamp, before redirecting or showing the landing page.
- **FR-013**: The system MUST record for each scan: browser/device type, country/city when available, and referrer.
- **FR-014**: The system MUST show merchants analytics for total scans, daily scans, per-device scans, browser/device type, country/city, referrer, and timestamps.
- **FR-015**: The system MUST show a clear inactive message instead of redirecting for unpublished, disabled, unclaimed, or destination-less devices.
- **FR-016**: The system MUST validate destination URLs when they are configured and inform the merchant of invalid values.
- **FR-017**: The system MUST list registered merchants and their devices for admins.
- **FR-018**: The system MUST serve a public marketing homepage at the site root presenting product branding and linking to merchant registration and login.
- **FR-019**: The homepage MUST be server-rendered, expose SEO metadata (title, description, canonical URL, Open Graph), and the site MUST expose robots directives and a sitemap for public pages.

### Key Entities *(include if feature involves data)*

- **Device**: Represents a physical NFC tag or QR code with a unique identity, a claim code, ownership, configuration, and a lifecycle status (unclaimed, claimed, published, unpublished, disabled, transferred).
- **Merchant**: A registered business account that owns devices, configures destinations, and views analytics.
- **Admin**: A privileged account that creates devices, manages inventory, and oversees merchants.
- **Destination**: A single configured redirect target or one entry in a multi-link page, typed as Google review, Instagram, Facebook, TikTok, WhatsApp, website, or custom URL.
- **Scan Event**: A recorded interaction on a device capturing outcome, source, browser/device, location when available, referrer, and timestamp.
- **Place**: A Google Places business listing referenced by a destination to generate a review link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A customer scanning a single-link device reaches the destination in under 2 seconds on a standard mobile connection.
- **SC-002**: A merchant can register, claim a device, configure a destination, and publish it in under 5 minutes.
- **SC-003**: 100% of successful redirects and landing-page views have a corresponding recorded scan event.
- **SC-004**: Scans that occur for a merchant's published devices appear in that merchant's analytics.
- **SC-005**: Unpublished, disabled, unclaimed, and destination-less devices never forward a customer to a destination.
- **SC-006**: The MVP is complete when an admin can create devices, a merchant can claim and configure them, and customers can successfully scan devices and reach configured destinations with analytics recorded.
- **SC-007**: A first-time visitor reaches a rendered, responsive homepage on mobile or desktop in under 2 seconds on a standard mobile connection, and the homepage carries machine-readable SEO metadata.

## Assumptions

- Device purchase happens outside the platform (no catalog, cart, or payment). Claim codes are distributed through the physical device packaging or another offline channel.
- No billing, plans, or subscription management is included in the MVP.
- A device holds one active configuration at a time; the merchant can edit it and changes apply to future scans.
- A transfer moves device ownership between two merchant accounts.
- Location (country/city) is derived from each scan and is best-effort; it may be unavailable for some scans.
- Google Places search requires an external service credential with usage limits; review-link generation uses the stored business reference.
- NFC taps open the device URL in the customer's phone browser via the device's built-in behavior (no native app required).
- Public pages must work on mobile browsers, meet WCAG AA accessibility, and be locatable by search engines. No native mobile apps are shipped in the MVP.
- The marketing homepage is a single public page at the site root; no separate marketing route group or additional marketing pages (features, pricing, legal) are part of the MVP.