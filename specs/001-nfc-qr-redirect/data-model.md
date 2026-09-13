# Data Model — NFC QR Redirect Platform

Phase 1 output for `/speckit.plan`. Drizzle ORM (MySQL 8), schema modules under
`db/schema/`. All identifiers are server-generated UUIDs unless noted. Timestamps are
UTC. Foreign keys are enforced at the database level.

> Implementation detail (schema → table SQL) lives in `drizzle/` via drizzle-kit and in
> `db/schema/*`. This document is the authoritative business data model and validation
> rules; it does not repeat DDL.

## Entities

### user (Better Auth managed)

Managed by Better Auth core tables (`user`, `session`, `account`). Extended with a
`role` claim.

- **Fields (extension)**: `role: 'ADMIN' | 'MERCHANT'` (default `MERCHANT`), `status:
  'ACTIVE' | 'DEACTIVATED'`.
- **Validation**: email unique and well-formed; password policy enforced by Better Auth.
- **Relationships**: 1—1 `merchant_profile` for MERCHANT users; 1—N devices (owned).

### merchant_profile

Extends a MERCHANT user with business details.

- **Fields**: `id`, `userId` (unique FK → user), `businessName`, `phone?`,
  `country?` (ISO), `createdAt`, `updatedAt`.
- **Validation**: `businessName` required, ≤120 chars; `country` ISO-3166 alpha-2.
- **Relationships**: 1—1 user; 1—N devices (owner).

### device

A physical NFC tag or QR code with a platform identity.

- **Fields**: `id` (uuid PK), `slug` (unique, public URL path segment, immutable),
  `name`, `status: 'UNCLAIMED' | 'CLAIMED' | 'PUBLISHED' | 'UNPUBLISHED' | 'DISABLED'`,
  `ownerId?` (FK → merchant_profile), `claimCodeHash` (salted hash, never stored
  plaintext), `createdAt`, `updatedAt`.
- **Validation**:
  - `slug`: unique, lowercase alphanumeric + hyphen, 6–32 chars, never reused.
  - `claimCode`: single-use; a fresh unguessable code is generated per device and
    distributed offline; only its hash is stored; claim requires owning that code.
  - `status` transitions (see State Transitions).
- **Relationships**: N—1 merchant_profile (owner); 1—N destinations; 1—N scan events.

### destination

One redirect target on a device (single-link = exactly one row; multi-link = 1–N rows
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
- **Validation**: `googlePlaceId` unique and required; `name` ≤200 chars.
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
  truncated to ≤300 chars; `city` ≤100 chars.
- **Relationships**: N—1 device; N—1 destination.
- **Volume**: appended-only, no updates. Age-out/partitioning is out of MVP scope
  (ponytail: naive unbounded growth, add archival when scan volume requires).

## State Transitions (device.status)

```text
UNCLAIMED ──claim (valid claim code + set owner)──▶ CLAIMED
CLAIMED   ──configure ≥1 active destination──▶     PUBLISHED (one-way gate:
                                                  needs ≥1 active destination)
PUBLISHED ──merchant unpublish──▶ UNPUBLISHED
UNPUBLISHED ──merchant publish──▶ PUBLISHED        (re-publish allowed)
{CLAIMED|PUBLISHED|UNPUBLISHED} ──admin disable──▶ DISABLED
DISABLED  ──admin re-enable──▶   CLAIMED           (admin action)
ANY ──admin OR merchant-initiated transfer──▶ ownership changes to another
                                              merchant_profile (status preserved)
```

- `DISABLED`, `UNPUBLISHED`, `UNCLAIMED`, and ownerless/`CLAIMED` devices resolve scans
  to the INACTIVE outcome (no redirect, no landing links).
- Transfer records new `ownerId` and `updatedAt`; it does not reset status or
  destinations.

## Indexes / Constraints (summary)

- `user.email` unique; `merchant_profile.userId` unique.
- `device.slug` unique; `device.ownerId` FK; `device.claimCodeHash` unique.
- `destination` unique `(deviceId, position)`; `destination.placeId` FK.
- `place.googlePlaceId` unique.
- `scan_event.deviceId` FK; composite index `(deviceId, createdAt)` for per-device
  daily aggregation; index on `createdAt` for merchant daily totals (day-prefix scans);
  index on `deviceType`, `browser`, `country` for analytics breakdowns.