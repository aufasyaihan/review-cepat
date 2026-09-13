# Contracts — Domain API Surface

Internal contract: client components talk ONLY to their domain's API layer
(`domains/<name>/api/{queries,mutations}.ts`); route handlers translate HTTP into
`domains/<name>/server/service.ts`. No component or hook calls `fetch()` directly
(constitution III, architecture rule 9). Tables/fields per
[data-model.md](../data-model.md).

## Public routes (external)

### `app/api/auth/[...all]/route.ts`

Better Auth route handler (POST/GET passthrough): sign-in, sign-up, session, sign-out.
No business logic beyond translation. RBAC role claim (`ADMIN` | `MERCHANT`)
enforced at domain permissions, not here.

### `app/s/[slug]/*`

Public device resolution — see [public-scan.md](public-scan.md).

## Domain API operations (client → route handler → domain service)

### auth

- `me()` — current session + role (guards UI).
- (Better Auth client handles sign-in/sign-up/sign-out/session.)

### merchant

- `register(payload)` — create merchant account (public).
- `profile()` — current merchant profile.
- Admin: `listMerchants()` — merchant list with device counts.

### device

- Merchant: `listOwned()`, `claim(claimCode)`, `get(id)`, `updateProfile(id, name)`,
  `publish(id)`, `unpublish(id)`, `transfer(id, toMerchantId)`.
- Admin: `listAll()`, `create(payload)` (returns `slug` + claim code), `disable(id)`,
  `enable(id)`.

### destination

- `listForDevice(deviceId)`, `setForDevice(deviceId, destinations[])` (single or
  multi-link, atomic), `searchPlaces(query)` (Google Places, server-side only),
  `generateReviewUrl(placeId)` (derived server-side), `toggleActive(destinationId)`.

### scan

- Public resolution is server-side only (see public-scan.md); no client route.
- `listEvents(deviceId, range)` — raw recent events for a device.

### analytics

- `overview(merchantId)` — totals + per-day + per-device aggregate.
- `breakdown(deviceId, dimension)` — browser/deviceType/country/city/referrer counts.

## Validation boundary

Every `payload` above is parsed with a Zod schema from `domains/<schemas>/` before
reaching a service (constitution VII); rejected payloads return field-level errors
the TanStack Form surfaces in the UI.