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
- Q: How should the app routes be organized? → A: Superseded by Q/A 2026-09-15 Session — see below. Route groups are exactly four: `(auth)`, `(dashboard)`, `(landing-page)`, `(redirect)` (FR-036).
- Q: What cookie prefix should Better Auth use? → A: `auth` (session cookie becomes `auth.session_token`); the Next.js 16 `proxy.ts` resolves the session via `auth.api.getSession`.
- Q: How should e2e run the app? → A: Always a production build — the e2e server runs `db:migrate` → `db:seed:e2e` → `build` → `next start` against the isolated `review_cepat_test` database (never the dev server).
- Q: Where must mutations and forms live? → A: Every `page.tsx` is a Server Component. All data mutations go through Server Actions (`'use server'`), never fetch-based route-handler mutations; every form is handled by TanStack Form submitting to a Server Action, and every mutation revalidates the affected TanStack Query cache keys on success.
- Q: What happens after login? → A: Sign-in redirects to `/dashboard` (root path for all roles — admin, merchant, sub-merchant) after a successful Server Action sign-in; every action shows a toast (login, create device, etc.). The app header is not part of the root layout.

### Session 2026-09-15

- Q: Should login/register pages use framer-motion animations? → A: Yes, use framer-motion for staggered entrance animations on the login and register pages (card fade-in, form field slide-up, button delay), matching the reference project pattern. Add framer-motion as a dependency.
- Q: Should the login/register page gradient use sky blue tones? → A: Yes, the login and register pages use a sky blue gradient background (`from-white via-sky-50/40 to-blue-50/60` light, `from-neutral-950 via-sky-950/10 to-blue-950/20` dark) with sky-tinted radial overlays, matching the primary color brand.
- Q: Should the dashboard header include breadcrumbs and a theme toggle? → A: Yes, the authenticated header includes SidebarTrigger, a vertical Separator, a DashboardBreadcrumb component, and a ThemeToggle button on the right — matching the reference project header pattern.
- Q: Should framer-motion animate dashboard page content too? → A: No, framer-motion is only for login and register pages. Dashboard pages rely on phantom-ui skeleton loading states instead.
- Q: Should the merchant and sub-merchant route groups be separated rather than nested? → A: Yes — and further: all roles (admin, merchant/reseller, sub-merchant) use root-level paths with no role-specific URL prefixes and no nested route groups. Navigation and endpoint access are resolved dynamically from a Better Auth `permission` table (one row per endpoint/nav item with `path`, `label`, `icon`, `is_menu`, and permitted roles), seeded by default. The sidebar reads from this table (is_menu=true), and route access is enforced against it in proxy.ts and layouts. The route groups are exactly four: `(auth)`, `(dashboard)`, `(landing-page)`, `(redirect)`. Analytics renders within /dashboard (owner role), not a standalone route.

### Session 2026-09-16

- Q: How should dashboard data views present tabular data? → A: Dashboard data views (device lists, members, merchants, organizations, analytics breakdowns) MUST render through a reusable `DataTable` component at `components/ui/data-table/` built on `@tanstack/react-table`, mirroring the reference project (`khitan-plus-hipnosis`) — sorting, filtering, pagination, column-visibility, `DataTableSkeleton`/empty states — not hand-rolled static `Table` markup.
- Q: Should API endpoints also be rows in the `permission` table? → A: Yes. API endpoints are `permission` rows with `parent_id` pointing to the page/menu row they serve, `path` = the endpoint (e.g. `/api/device`), `is_menu=false`, a dotted label (e.g. `api.create_device`), and permitted roles. `can()` gates endpoint access at the API layer (route handlers / domain API) just as it gates page access in proxy.ts and layouts.
- Q: Which actions require a confirmation dialog on the dashboard? → A: Every action that changes device or member state (publish, unpublish, reset, assign, unassign, transfer, disable, delete) MUST show a confirmation dialog before executing.
- Q: Does "create and delete uses dialog view not a page" retrofit the existing claim flow? → A: No. The existing `/devices/claim` page stays as a page. The dialog rule applies to create/delete flows built from now on (e.g. admin create device, admin delete device).
- Q: Should the MVP include a hard-delete capability? → A: Yes, an admin-only device delete, gated behind a confirmation dialog. It is a soft delete (see device-status question below).
- Q: What happens to a deleted device's rows and scan history? → A: Soft delete: the device is marked deleted and hidden from all lists, but its destinations, member assignment, and scan events are retained for audit and analytics integrity.
- Q: How is the soft-deleted state represented? → A: `deleted` is added as a device lifecycle status value (same single status column as the existing lifecycle states), not a separate flag column.

### Session 2026-09-14

- Q: What minimal info must the accountless setup page collect? → A: Claim code + destination URL only (zero-friction). Two-step setup: `/{id}/setup` (claim code) then `/{id}/setup/redirect` (choose single-link → Google Places search input that becomes the review redirect, or multiple-links → Google Places + custom URLs).
- Q: How is the organization and role hierarchy structured? → A: Merchant is an organization using Better Auth's organization plugin. Roles: `owner` (reseller — full access to device management, dashboard, sub-merchant management) and `member` (sub-merchant — device management only). An owner can sell devices to other merchants who become members of the same organization.
- Q: How should the accountless setup flow work end-to-end? → A: On initial device setup (unclaimed or reset), the merchant opens/ scans/ taps the NFC/QR URL and is redirected to `/{id}/setup`. They enter the claim code, then proceed to `/{id}/setup/redirect` to choose destination type. The device is set up without any account. If the merchant later wants dashboard access, they register using the claim code and the system creates an account linked to the device.
- Q: How does a reseller sell a device to another merchant within the organization? → A: The reseller (owner) can add a sub-merchant (member) to the organization. The sub-merchant gains device management access for devices assigned to them. The reseller retains full dashboard visibility across all organization devices.
- Q: Can a merchant register a device directly from the dashboard without going through the setup URL? → A: Yes. A reseller can register a device on the dashboard directly (input claim code + configure) without requiring a separate login step. The device is added to the reseller's organization.
- Q: When a sub-merchant registers using a claim code and the device has no connected account, what is the organizational outcome? → A: The sub-merchant joins the reseller's organization as a `member`. The device is added to that organization and is available on both the sub-merchant's dashboard and the owner's dashboard, so the owner can manage it.
- Q: How does a device become associated with a reseller's organization before any merchant claims it? → A: Admin assigns the device to the reseller's organization at creation/sale time; the device carries an `organizationId` from then on. Any later sub-merchant claim routes them into that organization.
- Q: How is a device attached to a specific sub-merchant within the organization? → A: Devices are individually assigned to a specific sub-merchant (member) at reseller sale time, captured as a per-device member assignment. The sub-merchant sees only assigned devices; the owner sees all devices in the organization.
- Q: Who can reset a device and what does it clear? → A: Two reset scopes: (1) the owner (reseller) can reset, clearing configuration and member assignment but keeping the organization binding; (2) the admin can reset, clearing everything including the organization binding back to unclaimed/admin-owned. Either reset regenerates a fresh claim code so the device can be set up again.
- Q: Which component library must the UI be built with? → A: shadcn/ui, added via the CLI (`npx shadcn@latest add <component>`), configured to use Base UI (base-ui.com) primitives rather than Radix. Use shadcn components as much as possible — no hand-rolled replacements for standard primitives.
- Q: What shell layout should authenticated areas use? → A: All authenticated areas (admin, reseller dashboard, sub-merchant dashboard) use the shadcn `sidebar` shell. Public/auth screens (login, register, device setup) use a centered card, with login/register centered on both x and y axes.
- Q: When must toasts appear? → A: Every action or mutation surfaces a toast on success and on error — login, register, claim device, configure destination, publish/unpublish, assign device, reset, create device, transfer, etc.
- Q: What visual style and primary color should the product use? → A: Minimalist yet enterprise: neutral whites/grays, restrained spacing and typography, and sky blue (Tailwind `sky` scale) as the primary color.
- Q: How should loading states be handled on every page? → A: Every page with data loads shows a skeleton via Next.js `loading.tsx` or a client Suspense boundary per component. Skeletons use phantom-ui (`@aejkatappaja/phantom-ui`), a structure-aware skeleton Web Component enabled client-side that wraps the real component in `<phantom-ui loading>` and measures the DOM for shimmer blocks. The phantom-ui `init` command adds its SSR pre-hydration CSS and JSX type declarations.
- Q: Where should theming apply? → A: Install next-themes and provide a theme provider on the login and dashboard areas only; the public redirect route (/s/[slug]) must not get the theme provider.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accountless device setup via URL (Priority: P1)

A merchant who has purchased a physical device opens, scans, or taps the device URL directly (no account required). The device URL routes to `/{id}/setup` where the merchant enters the claim code. On success they proceed to `/{id}/setup/redirect` to choose a destination type: single-link (opens a Google Places search input; the selected place becomes the redirect destination for reviews) or multiple-links (Google Places search plus custom URLs). After submitting, the device is fully set up and active.

**Why this priority**: This is the first interaction a merchant has with the platform and must work with zero prior account state. Getting this right determines whether the product is easy to sell and adopt.

**Independent Test**: Can be fully tested by navigating to an unclaimed device URL, entering a valid claim code, choosing single-link, selecting a Google Place, and verifying the device is active and redirects correctly on scan.

**Acceptance Scenarios**:

1. **Given** an unclaimed device, **When** a user opens the device URL, **Then** the `/{id}/setup` page renders asking for a claim code (no login required).
2. **Given** a valid claim code entered on the setup page, **When** the user submits, **Then** they are redirected to `/{id}/setup/redirect` to choose a destination type.
3. **Given** single-link chosen on the redirect page, **When** the user searches and selects a Google Place, **Then** the device is configured to redirect to that place's review page and the device becomes active.
4. **Given** multiple-links chosen, **When** the user adds a Google Place and/or custom URLs, **Then** the device is configured with a multi-link page and becomes active.
5. **Given** an invalid or already-claimed claim code entered, **When** submission is attempted, **Then** a clear error is shown and the user remains on the setup page.

---

### User Story 2 - Merchant claims device from dashboard with account (Priority: P1)

A logged-in merchant (reseller or sub-merchant) claims a device by entering a claim code from the dashboard. The merchant chooses to login or register: login associates the device with the existing account; register creates a new account if the device has no connected account. The device is then added to the merchant's organization.

**Why this priority**: This covers the secondary claim path — when a merchant already has an account and wants to claim another device under the same organization.

**Independent Test**: Can be fully tested by logging in, entering a claim code, and verifying the device appears in the merchant's device list with correct organization association.

**Acceptance Scenarios**:

1. **Given** a logged-in merchant, **When** the merchant enters a valid claim code from the dashboard, **Then** a choice between login or register is presented to associate the device with an account.
2. **Given** the merchant chooses register and the device has no connected account, **When** registration completes, **Then** an account is created, the device is linked to it, and the merchant proceeds to destination setup.
3. **Given** the merchant chooses login, **When** authentication succeeds, **Then** the device is registered to that account and the merchant proceeds to destination setup.
4. **Given** a logged-in reseller, **When** the reseller registers a device directly from the dashboard, **Then** the device is added to the reseller's organization without requiring a separate login step.
5. **Given** a valid claim code and destination configured, **When** submission completes, **Then** the device status becomes "published" and shows the configured destination.

---

### User Story 3 - Customer scans a device and reaches its destination (Priority: P1)

A customer taps an NFC device with their phone or scans its QR code. For a single-link device they are redirected immediately to the destination; for a multi-link device they see a public landing page listing all links. Every scan is recorded automatically before the customer proceeds.

**Why this priority**: This is the core promise of the product — customers reach the intended destination (e.g. a Google review form) with zero friction. It delivers the value merchants pay for.

**Independent Test**: Can be fully tested by scanning a seeded published single-link device and verifying an immediate redirect to the destination, then scanning a multi-link device and verifying the landing page — delivers the redirect experience without any admin or analytics UI.

**Acceptance Scenarios**:

1. **Given** a published device configured with a single destination, **When** a customer scans it, **Then** the customer is forwarded to the destination without an intermediate page.
2. **Given** a published device configured with multiple destinations, **When** a customer scans it, **Then** the customer sees a page listing all links and can open any of them.
3. **Given** a published device, **When** a customer scans it, **Then** a scan event is recorded (outcome, source, timestamp) before the customer is redirected.
4. **Given** an unpublished or disabled device, **When** a customer scans it, **Then** the customer sees a clear inactive message instead of a redirect.

---

### User Story 4 - Reseller manages devices, analytics, and sub-merchants (Priority: P2)

A reseller (organization owner) logs in and sees a dashboard with device management, scan analytics, and sub-merchant management. The reseller can view all devices across the organization, see analytics, and manage sub-merchants (members) who have device management access.

**Why this priority**: The reseller dashboard is the control center for the organization's device fleet. It carries no customer-facing value by itself, but it produces the inventory and oversight merchants depend on.

**Independent Test**: Can be fully tested by logging in as a reseller, viewing devices, analytics, and the sub-merchant list — delivers organizational management without customer-facing features.

**Acceptance Scenarios**:

1. **Given** a logged-in reseller, **When** the dashboard is opened, **Then** all devices in the organization are listed with their status and analytics.
2. **Given** a reseller, **When** the analytics section of the dashboard is opened, **Then** total scans, per-device scans, daily scans, browser/device, location, referrer, and timestamps are displayed.
3. **Given** a reseller, **When** the user-management view is opened, **Then** a list of members in the organization is shown with their roles and assigned devices.
4. **Given** a reseller, **When** a sub-merchant is invited or added, **Then** the new member is added to the organization with the `member` role and gains device management access.
5. **Given** a reseller selling a device to a sub-merchant, **When** the reseller assigns the device to that member, **Then** the device becomes visible on both the member's dashboard and the owner's dashboard.

---

### User Story 5 - Sub-merchant manages devices (Priority: P2)

A sub-merchant (organization member) logs in and sees a device management view. The sub-merchant can view and configure devices assigned to them but cannot see analytics or manage other members.

**Why this priority**: Sub-merchants need to manage their assigned devices but have no organizational oversight responsibility.

**Independent Test**: Can be fully tested by logging in as a sub-merchant, viewing assigned devices, and verifying that analytics and member management are not accessible.

**Acceptance Scenarios**:

1. **Given** a logged-in sub-merchant, **When** the device list is opened, **Then** only devices assigned to this sub-merchant are shown.
2. **Given** a sub-merchant, **When** attempting to access analytics or member management, **Then** access is denied or the views are not shown.
3. **Given** a sub-merchant, **When** editing a device's destination, **Then** the changes apply to future scans.
4. **Given** a device assigned to a sub-merchant, **When** the owner (reseller) opens the dashboard, **Then** the owner can also view and manage that device.

---

### User Story 6 - Admin manages devices and merchants (Priority: P2)

An admin logs in, creates devices (generating a unique identity and claim code for each), assigns devices to reseller organizations, manages the inventory, publishes or disables devices, and views merchant organizations.

**Why this priority**: It carries no customer-facing value by itself, but it produces the inventory merchants depend on, so it follows the P1 journeys.

**Independent Test**: Can be fully tested by creating several devices, verifying each gets a distinct identity, assigning one to a reseller organization, disabling one, and listing merchant organizations — delivers inventory management without customer-facing features.

**Acceptance Scenarios**:

1. **Given** a logged-in admin, **When** the admin creates a device, **Then** a unique device identity and a claim code are generated.
2. **Given** two devices created at the same time, **When** compared, **Then** their identities are distinct.
3. **Given** a device inventory list, **When** the admin disables a device, **Then** it is marked disabled and cannot be scanned to a destination.
4. **Given** an administered platform, **When** the admin opens the merchants view, **Then** a list of merchant organizations and their devices is shown.
5. **Given** a logged-in admin creating a device for a reseller, **When** the admin assigns the device to the reseller's organization, **Then** the device carries that `organizationId` from then on.

---

### User Story 7 - Merchant attaches a Google review destination (Priority: P2)

A merchant searches for a business via Google Places, selects the matching listing, and attaches it to a device. The review destination is stored by business reference and the review link is generated automatically so customers can be directed straight to that business's reviews.

**Why this priority**: Google reviews are the primary redirect use case in the product brief and automate a common merchant task, but the redirect engine works with plain URLs too.

**Independent Test**: Can be fully tested by searching a place, selecting a listing, attaching it as a single-link destination, and verifying the generated review link opens the listing's reviews for a customer scan.

**Acceptance Scenarios**:

1. **Given** a merchant on the destination setup screen, **When** the merchant searches for a business, **Then** a list of matching businesses is shown.
2. **Given** search results displayed, **When** the merchant selects one, **Then** the selection becomes a review destination on the device.
3. **Given** a review destination attached, **When** a customer scans the device, **Then** they are sent to that business's review page.
4. **Given** a search with no matches, **When** the merchant submits it, **Then** a clear "no results" message is shown and the merchant can search again.

---

### User Story 8 - Visitor views the marketing homepage (Priority: P2)

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
- A reseller transferring a device to another organization or sub-merchant.
- Google Places searches returning no matches or the merchant choosing none.
- A single-link destination URL that is invalid or unreachable at configuration time.
- A device whose organization account is deactivated while the device is published.
- A claim code used simultaneously from the accountless setup flow and the dashboard flow (claim code is single-use; the first validator wins, others receive an error).
- A sub-merchant entering a claim code for a device bound to a different organization.
- An owner removing the last sub-merchant from an organization (Better Auth last-owner protection).
- Resetting a device that is currently published (reset unpublishes it and requires re-setup via the fresh claim code).
- An admin deleting a device that is currently published (deletion sets the `deleted` status; the device no longer forwards scans and is hidden from all device lists).
- Every state-changing dashboard action (publish, unpublish, reset, assign/unassign, transfer, disable, delete) requires user confirmation — an accidental submit must be blockable in the dialog.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow merchants to register an account using a claim code (no pre-existing account required for initial device setup).
- **FR-002**: The system MUST allow admins to log in with elevated privileges.
- **FR-003**: The system MUST allow admins to create devices and MUST generate a unique device identity and a claim code for each device.
- **FR-026**: When an admin creates a device, the system MUST allow the admin to assign the device to a reseller's organization at creation/sale time, binding the device's `organizationId` from then on.
- **FR-004**: The system MUST allow accountless device setup via the device URL: `/{id}/setup` (claim code input) then `/{id}/setup/redirect` (destination type selection — single-link via Google Places search, or multiple-links via Google Places + custom URLs). No login is required.
- **FR-005**: The system MUST allow a merchant to claim a device using a valid claim code from the dashboard, presenting a login-or-register choice to associate the device with an account.
- **FR-006**: The system MUST allow a merchant to configure a device with a single destination link or multiple destination links.
- **FR-007**: The system MUST support these destination types: Google review, Instagram, Facebook, TikTok, WhatsApp, website, and custom URL.
- **FR-008**: The system MUST allow a merchant to publish and unpublish their devices at any time.
- **FR-009**: The system MUST allow a device to be activated, disabled, or transferred to another organization account.
- **FR-010**: The system MUST allow a merchant to search businesses via Google Places, select a listing, store its reference, and generate the review link automatically.
- **FR-011**: When a customer scans a device configured with a single link, the system MUST forward them to the destination immediately.
- **FR-012**: When a customer scans a device configured with multiple links, the system MUST show a public landing page listing all links.
- **FR-013**: The system MUST record a scan event, including outcome, source, and timestamp, before redirecting or showing the landing page.
- **FR-014**: The system MUST record for each scan: browser/device type, country/city when available, and referrer.
- **FR-015**: The system MUST show merchants analytics for total scans, daily scans, per-device scans, browser/device type, country/city, referrer, and timestamps.
- **FR-016**: The system MUST show a clear inactive message instead of redirecting for unpublished, disabled, unclaimed, or destination-less devices.
- **FR-017**: The system MUST validate destination URLs when they are configured and inform the merchant of invalid values.
- **FR-018**: The system MUST list registered merchant organizations and their devices for admins.
- **FR-019**: The system MUST serve a public marketing homepage at the site root presenting product branding and linking to merchant registration and login.
- **FR-020**: The homepage MUST be server-rendered, expose SEO metadata (title, description, canonical URL, Open Graph), and the site MUST expose robots directives and a sitemap for public pages.
- **FR-021**: The system MUST integrate Better Auth's organization plugin. Each merchant is an organization. The `owner` role (reseller) has full access: device management, dashboard analytics, and sub-merchant management. The `member` role (sub-merchant) has device management only.
- **FR-022**: The system MUST allow a reseller (owner) to add sub-merchants (members) to the organization. Sub-merchants gain device management access for assigned devices.
- **FR-023**: The system MUST allow a reseller to register a device directly from the dashboard without a separate login step, adding it to the reseller's organization.
- **FR-024**: The system MUST allow a sub-merchant to register using a claim code; if the device has no connected account, the system MUST create an account, add the sub-merchant to the device's organization as a `member`, and link the device to that organization.
- **FR-025**: Devices assigned to a sub-merchant MUST be visible and manageable on both the sub-merchant's dashboard and the owner's (reseller's) dashboard.
- **FR-027**: The system MUST allow a reseller to individually assign a device to a specific sub-merchant (member) at sale time; the sub-merchant sees only assigned devices, while the owner sees all devices in the organization.
- **FR-028**: The system MUST allow two device reset scopes: (1) the owner (reseller) may reset a device, clearing its configuration and member assignment but keeping the `organizationId` binding; (2) the admin may reset a device, clearing everything including the organization binding back to unclaimed/admin-owned. Either reset MUST rotate to a fresh claim code so the device can be set up again.
- **FR-029**: The UI MUST be built with shadcn/ui components added via the CLI (`npx shadcn@latest add <component>`), using Base UI primitives, and MUST use shadcn components wherever a standard primitive exists.
- **FR-030**: Authenticated areas (admin, reseller dashboard, sub-merchant dashboard) MUST use the shadcn `sidebar` shell layout. Public and auth screens (login, register, device setup) MUST use a centered card layout, with login/register centered on both the x and y axes.
- **FR-031**: Every action or mutation (login, register, claim device, configure destination, publish/unpublish, assign device, reset, create device, transfer) MUST surface a toast on both success and error.
- **FR-032**: The product MUST use a minimalist, enterprise visual style — neutral whites/grays, restrained spacing and typography — with sky blue (Tailwind `sky` scale) as the primary color.
- **FR-033**: Every page that loads data MUST show a skeleton loading state via Next.js `loading.tsx` or a client Suspense boundary per component, using phantom-ui (`@aejkatappaja/phantom-ui`) to generate structure-aware shimmer placeholders, and MUST NOT block hydration on the skeleton.
- **FR-034**: The system MUST provide a light/dark theme via next-themes on the login and dashboard areas only; the public redirect route (`/s/[slug]`) MUST NOT include the theme provider.
- **FR-035**: Login and register pages MUST use framer-motion for staggered entrance animations — card fade-in, form field slide-up with delay stagger, and button entrance — matching the reference project pattern. Dashboard pages MUST NOT use framer-motion; skeleton loading states (phantom-ui) handle the loading UX instead.
- **FR-036**: All roles (admin, reseller, sub-merchant) MUST use root-level paths with no role-specific URL prefixes and no nested route groups. Which pages a role can reach and which items appear in the sidebar MUST be resolved from a seeded `permission` table at runtime.
- **FR-038**: Dashboard data views (device lists, members, merchants, organizations, analytics breakdowns) MUST render through a reusable `DataTable` component at `components/ui/data-table/` built on `@tanstack/react-table`, mirroring the reference project — with sorting, filtering, pagination, column-visibility, `DataTableSkeleton`/empty states — rather than hand-rolled static `Table` markup.
- **FR-037**: The system MUST expose a `permission` table storing navigation rows AND API-endpoint rows (`path`, `label`, `icon`, `is_menu`, `parent_id`, permitted roles). Navigation rows have `is_menu=true` and `parent_id=null`; API-endpoint rows reference the page they serve via `parent_id`, use the endpoint as `path` (e.g. `/api/device`), `is_menu=false`, and a dotted label (e.g. `api.create_device`). The table MUST be seeded by default so each role sees the correct nav menu — admin: Dashboard/Devices/User management/Merchants/Settings; reseller: Dashboard/Devices/User management/Settings; sub-merchant: Dashboard/Devices/Settings — and route access MUST be enforced against this table in the proxy/guard and in layouts, and API access MUST be enforced against it at the API layer (route handlers / domain API).
- **FR-039**: Every dashboard action that changes device or member state (publish, unpublish, reset, assign/unassign, transfer, disable, delete) MUST be preceded by a confirmation dialog before it executes. The dialog MUST state what the action does and provide explicit Confirm/Cancel actions.
- **FR-040**: Device create and delete flows built in this feature (admin create device, admin delete device) MUST use a dialog view rather than a separate page. This does NOT retrofit the existing `/devices/claim` page, which stays a page.

### Key Entities *(include if feature involves data)*

- **Organization (Merchant)**: A Better Auth organization representing a merchant business. Contains an owner (reseller) and members (sub-merchants). Owns devices and configurations. Uses Better Auth's organization plugin with `owner` and `member` roles.
- **Device**: Represents a physical NFC tag or QR code with a unique identity, a claim code, organization ownership (`organizationId` bound at admin creation/sale), an optional per-device member assignment (sub-merchant), a configuration, and a lifecycle status (unclaimed, claimed, published, unpublished, disabled, deleted, transferred). The `deleted` status is a soft-delete state set by an admin; the device is hidden from all lists but its destinations, member assignment, and scan events are retained. Modeled as one status column shared with the other lifecycle states.
- **Admin**: A privileged account that creates devices, manages inventory, and oversees merchant organizations.
- **Destination**: A single configured redirect target or one entry in a multi-link page, typed as Google review, Instagram, Facebook, TikTok, WhatsApp, website, or custom URL.
- **Scan Event**: A recorded interaction on a device capturing outcome, source, browser/device, location when available, referrer, and timestamp.
- **Place**: A Google Places business listing referenced by a destination to generate a review link.
- **Permission (Navigation/Endpoint)**: A row defining an accessible route (page or API endpoint) and whether it appears in the sidebar nav. Columns: `path`, `label`, `icon`, `is_menu` (sidebar visibility), `parent_id` (null for nav rows; the id of the page row an API row serves), and role(s) permitted (admin, owner, member). API rows use `is_menu=false`, `path` = the endpoint, and a dotted label (`api.<action>`). Seeded by default so each role sees the correct nav items and endpoint access is enforced by the permissions table at the sidebar, the proxy.ts/guard level, and the API layer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A customer scanning a single-link device reaches the destination in under 2 seconds on a standard mobile connection.
- **SC-002**: A merchant can complete accountless device setup (open URL → enter claim code → choose destination → active device) in under 2 minutes.
- **SC-003**: 100% of successful redirects and landing-page views have a corresponding recorded scan event.
- **SC-004**: Scans that occur for a merchant's published devices appear in that merchant's analytics.
- **SC-005**: Unpublished, disabled, unclaimed, and destination-less devices never forward a customer to a destination.
- **SC-006**: The MVP is complete when an admin can create devices, a merchant can claim and configure them (accountless or via dashboard), and customers can successfully scan devices and reach configured destinations with analytics recorded.
- **SC-007**: A first-time visitor reaches a rendered, responsive homepage on mobile or desktop in under 2 seconds on a standard mobile connection, and the homepage carries machine-readable SEO metadata.
- **SC-008**: A sub-merchant can view and manage only their assigned devices; analytics and member management are not accessible.
- **SC-009**: 100% of pages that load data render a phantom-ui skeleton loading state (via `loading.tsx` or a per-component client Suspense boundary) while data is pending, and 100% of actions surface a toast on success and error.
- **SC-010**: Login and register screens are centered on both axes in any viewport, authenticated areas render the sidebar shell, and the theme provider is present on login and dashboard pages but absent from the public redirect route.

## Assumptions

- Device purchase happens outside the platform (no catalog, cart, or payment). Claim codes are distributed through the physical device packaging or another offline channel.
- No billing, plans, or subscription management is included in the MVP.
- A device holds one active configuration at a time; the merchant can edit it and changes apply to future scans.
- A transfer moves device ownership between two organizations.
- Location (country/city) is derived from each scan and is best-effort; it may be unavailable for some scans.
- Google Places search requires an external service credential with usage limits; review-link generation uses the stored business reference.
- NFC taps open the device URL in the customer's phone browser via the device's built-in behavior (no native app required).
- Public pages must work on mobile browsers, meet WCAG AA accessibility, and be locatable by search engines. No native mobile apps are shipped in the MVP.
- The marketing homepage is a single public page at the site root; no separate marketing route group or additional marketing pages (features, pricing, legal) are part of the MVP.
- Better Auth's organization plugin handles the merchant hierarchy: `owner` = reseller (full access), `member` = sub-merchant (device management only). Custom roles may be added via dynamic access control if needed.
- phantom-ui (`@aejkatappaja/phantom-ui`) is a client-side Web Component; it needs the phantom-ui `init` one-time setup (SSR pre-hydration CSS import and JSX type declaration) and is imported on the client only. It is a deliberate user-mandated dependency alongside shadcn/ui (Base UI) and next-themes.
- The public redirect route (`/s/[slug]`) renders with no theme provider and no authenticated layout; it stays a fast, plain, server-rendered redirect surface.
