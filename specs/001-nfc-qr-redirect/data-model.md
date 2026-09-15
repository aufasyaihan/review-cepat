# Data Model — NFC QR Redirect Platform

Phase 1 output for `/speckit.plan` (regenerated for the organization + accountless-setup
model). Drizzle ORM (MySQL 8), schema modules under `db/schema/`. All identifiers are
server-generated UUIDs unless noted. Timestamps are UTC. Foreign keys are enforced at
the database level.

> Implementation detail (schema → table SQL) lives in `drizzle/` via drizzle-kit and in
> `db/schema/*`. This document is the authoritative business data model and validation
> rules; it does not repeat DDL.

## Entities

### user (Better Auth managed)

Managed by Better Auth core tables (`user`, `session`, `account`). Extended with a
platform `role` claim.

- **Fields (extension)**: `role: 'ADMIN' | 'MERCHANT'` (default `MERCHANT`), `status:
  'ACTIVE' | 'DEACTIVATED'`.
- **Validation**: email unique and well-formed; password policy enforced by Better Auth.
- **Roles**: `ADMIN` users hold a platform-admin account and belong to no organization.
  `MERCHANT` users act within one or more organizations via `member` rows
  (Better Auth organization plugin).
- **Relationships**: 1—N memberships (member); N—M organizations through `member`.

### organization (Better Auth plugin)

A merchant business. Created when the first owner registers; the creator is assigned the
`owner` role by the plugin.

- **Fields**: `id`, `name`, `slug` (unique), `logo?`, `metadata?` (JSON), `createdAt`,
  `updatedAt`.
- **Validation**: `name` required ≤ 120 chars; `slug` unique.
- **Relationships**: 1—N members; 1—N devices (owner); 1—N invitations.

### member (Better Auth plugin)

A user's role inside an organization.

- **Fields**: `id`, `organizationId` (FK → organization), `userId` (FK → user),
  `role: 'owner' | 'member'`, `createdBy?`, `createdAt`.
- **Validation**: unique (`organizationId`, `userId`); roles restricted to `owner`
  (reseller) and `member` (sub-merchant). Better Auth last-owner protection prevents
  removing the last owner.
- **Relationships**: N—1 organization; N—1 user; 1—N assigned devices (`device.memberId`).

### invitation (Better Auth plugin)

Pending membership invites sent by the owner.

- **Fields**: `id`, `organizationId` (FK), `email`, `role`, `status`, `expiresAt`,
  `inviterId?`, `createdAt`.
- **Validation**: status lifecycle managed by Better Auth; invitations expire (48h default).

### device

A physical NFC tag or QR code with a platform identity, bound to an organization.

- **Fields**: `id` (uuid PK), `slug` (unique, public URL path segment, immutable),
  `name`, `status: 'UNCLAIMED' | 'CLAIMED' | 'PUBLISHED' | 'UNPUBLISHED' | 'DISABLED'`,
  `organizationId` (FK → organization, required, bound at admin creation/sale),
  `memberId?` (FK → member, per-device sub-merchant assignment),
  `boundUserId?` (FK → user, the account that registered/claimed via the claim code),
  `claimCodeHash` (salted hash, never stored plaintext), `createdAt`, `updatedAt`.
- **Validation**:
  - `slug`: unique, lowercase alphanumeric + hyphen, 6–32 chars, never reused.
  - `claimCode`: a long-lived per-device secret distributed offline (device packaging).
    It authenticates THE SAME device for multiple uses: accountless setup, dashboard
    claim, and account registration/binding (FR-004/005/023/024). Only its hash is
    stored. It is NOT consumed by fulfillment; it rotates to a fresh unguessable code on
    every reset (FR-028). It may be bound to only one user account (`boundUserId` null
    until first registration; a second binding attempt with the same code is rejected).
  - `status` transitions (see State Transitions).
- **Relationships**: N—1 organization; N—1 member (assignment); 1—N destinations;
  1—N scan events.

### destination

One redirect target on a device (single-link = exactly one row; multi-link = 1—N rows
with `position` order).

- **Fields**: `id`, `deviceId` (FK), `type: 'GOOGLE_REVIEW' | 'INSTAGRAM' | 'FACEBOOK'
  | 'TIKTOK' | 'WHATSAPP' | 'WEBSITE' | 'CUSTOM_URL'`, `label?`, `url?`, `placeId?`
  (FK → place, for GOOGLE_REVIEW), `position` (int, order in multi-link page), `active`
  (bool, enabled/disabled by merchant), `createdAt`, `updatedAt`.
- **Validation**:
  - At least one destination with `active = true` exists before a device can be
    PUBLISHED.
  - `WEBSITE` / `CUSTOM_URL` / `WHATSAPP`: `url` required, must be a valid absolute
    `http(s)`/`whatsapp://wa.me` URL via Zod.
  - `GOOGLE_REVIEW`: `placeId` required; `url` derived server-side from the place
    (`https://search.google.com/local/writereview?placeid=<PLACE_ID>`) and nulled on
    edit until re-derived.
  - `position` unique within a device and contiguous from 0.
- **Relationships**: N—1 device; N—1 place (GOOGLE_REVIEW only).

### place

A Google business listing referenced by a review destination.

- **Fields**: `id`, `googlePlaceId` (unique), `name`, `formattedAddress?`, `website?`,
  `createdAt`.
- **Validation**: `googlePlaceId` unique and required; `name` ≤ 200 chars.
- **Relationships**: 1—N destinations (GOOGLE_REVIEW).

### scan_event

One recorded interaction with a public device.

- **Fields**: `id`, `deviceId` (FK), `destinationId?` (FK → destination, the resolved
  single link or null for landing page), `outcome: 'REDIRECTED' | 'LANDING_SHOWN' |
  'INACTIVE' | 'NOT_FOUND'`, `browser?`, `deviceType?` ('mobile' | 'tablet' | 'desktop'
  | 'unknown'), `country?` (ISO alpha-2), `city?`, `referrer?`, `source` (nfc | qr |
  link), `userAgent` (raw, truncated), `ipHash` (one-way hash of client IP for
  uniqueness, not PII-recoverable), `createdAt` (UTC, indexed).
- **Validation**: `deviceId` + `createdAt` required; `outcome` mandatory; `referrer`
  truncated to ≤ 300 chars; `city` ≤ 100 chars.
- **Relationships**: N—1 device; N—1 destination.
- **Volume**: appended-only, no updates. Age-out/partitioning is out of MVP scope
  (ponytail: naive unbounded growth, add archival when scan volume requires).

### permission

An endpoint/nav-item row seeded by default. Controls which paths each role can access
and which items appear in the sidebar (FR-037). Two row kinds:

- **Navigation rows**: `is_menu=true`, `parent_id=null`, `icon` set — appear in the
  sidebar and gate pages in proxy.ts/layouts.
- **API-endpoint rows**: `is_menu=false`, `parent_id` = the page row they serve,
  `path` = the endpoint (e.g. `/api/device`), `icon` null, dotted label
  (e.g. `api.create_device`) — gate access at the API layer (FR-037).

- **Fields**: `id` (uuid PK), `path` (unique, non-null; e.g. `/dashboard`,
  `/devices/new`, or an API route like `/api/device`), `label` (display string;
  dotted `api.<action>` for API rows), `icon?` (lucide-react icon name, nav rows
  only), `is_menu` (boolean — true if it appears in the sidebar nav),
  `parent_id?` (nullable self-reference: for API rows, the id of the page row they
  serve), `roles` (array of allowed role identifiers, e.g. `['ADMIN']`,
  `['OWNER']`, `['OWNER','MEMBER']`), `sort` (int — nav order when is_menu=true;
  0 for API rows), `createdAt`.
- **Validation**: `path` unique and non-empty; `roles` non-empty; `is_menu` boolean;
  API rows (`is_menu=false`) must set `parent_id` to an existing nav permission row.
- **Relationships**: no FK references to business tables; `parent_id` is a
  self-reference; pure configuration table seeded via `db/seed.ts`.
- **Seed strategy**: static rows inserted by the seed script; all three roles receive
  their default nav (Admin: Dashboard/Devices/User management/Merchants/Settings;
  Owner: Dashboard/Devices/User management/Settings; Member: Dashboard/Devices/Settings)
  plus API-endpoint rows for every permissioned mutation/query route, each linked to its
  serving page and labeled `api.<action>` (e.g. `api.create_device`).
  The `(dashboard)/layout.tsx` sidebar calls `listNavForRole(role)` (domains/auth) to read
  `is_menu=true` rows; the layout guard calls `can(role, path)` to deny access to
  restricted endpoints before rendering.

## State Transitions (device.status)

```text
UNCLAIMED ──setup/setup redirected OR dashboard claim (valid claim code)──▶ CLAIMED
CLAIMED   ──configure ≥1 active destination──▶     PUBLISHED (one-way gate:
                                                  needs ≥1 active destination)
PUBLISHED ──merchant unpublish──▶ UNPUBLISHED
UNPUBLISHED ──merchant publish──▶ PUBLISHED        (re-publish allowed)
{CLAIMED|PUBLISHED|UNPUBLISHED} ──admin disable──▶ DISABLED
DISABLED  ──admin re-enable──▶   CLAIMED           (admin action)
ANY ──owner reset──▶ CLAIMED (destinations cleared, memberId + boundUserId nulled,
                              organizationId KEPT, claim code rotated)   [FR-028]
ANY ──admin reset──▶ UNCLAIMED (destinations cleared, memberId + boundUserId nulled,
                              organizationId CLEARED, claim code rotated) [FR-028]
ANY ──transfer/ownership move──▶ another organization or member
                              (status preserved; reassign organizationId/memberId)
```

- `DISABLED`, `UNPUBLISHED`, `UNCLAIMED`, and ownerless/`CLAIMED` devices resolve scans
  to the INACTIVE outcome (no redirect, no landing links).
- Resets rotate the claim code (fresh hash) so the device can be set up again.
- Account binding (`boundUserId`) and member assignment (`memberId`) are separate from
  status: a device can be PUBLISHED via accountless setup while `boundUserId` is still
  null, and later bound when the merchant registers with the claim code.

## Authorization Visibility

- `owner` (reseller) — sees analytics + every device where `device.organizationId` is
  in one of their organizations; can manage members and reset (keep-org) their devices.
- `member` (sub-merchant) — sees only devices where `device.memberId = <their member row>`
  (FR-025/027, SC-008); device management only; analytics and member management denied.
- `ADMIN` — sees all organizations and devices; can disable devices and reset (clear-org).

## Indexes / Constraints (summary)

- `user.email` unique; `member(organizationId, userId)` unique; `organization.name`,
  `organization.slug` unique.
- `device.slug` unique; `device.organizationId` FK (required); `device.memberId` FK;
  `device.boundUserId` FK; `device.claimCodeHash` unique.
- `destination` unique `(deviceId, position)`; `destination.placeId` FK.
- `place.googlePlaceId` unique.
- `scan_event.deviceId` FK; composite index `(deviceId, createdAt)` for per-device
  daily aggregation; index on `createdAt` for merchant daily totals (day-prefix scans);
  index on `deviceType`, `browser`, `country` for analytics breakdowns.