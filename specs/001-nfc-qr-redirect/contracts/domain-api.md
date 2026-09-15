# Contracts — Domain API Surface

Internal contract: client components talk ONLY to their domain's API layer
(`domains/<name>/api/{queries,mutations}.ts`); route handlers translate HTTP into
`domains/<name>/server/service.ts`. No component or hook calls `fetch()` directly
(constitution III, architecture rule 9). Tables/fields per [data-model.md](../data-model.md).

## Public routes (external)

### `app/api/auth/[...all]/route.ts`

Better Auth route handler (POST/GET passthrough): sign-in, sign-up, session, sign-out,
plus organization endpoints (invite, accept, list members, set active org, assign role).
No business logic beyond translation. Org roles (`owner` | `member`) enforced at domain
permissions, not here.

### `app/[slug]/setup` and `app/[slug]/setup/redirect`

Accountless device setup — see [setup-claim.md](setup-claim.md). No theme provider, no
auth required (FR-004).

### `app/s/[slug]/*`

Public device resolution — see [public-scan.md](public-scan.md).

## Domain API operations (client → route handler → domain service)

### auth

- `me()` — current session + role + active organization(s) (guards UI).
- (Better Auth client handles sign-in/sign-up/sign-out/session/org invitations.)

### merchant (organization + members)

- `registerWithClaimCode(payload)` — accountless-claimed device: create account, join
  the device's `organizationId` as `member`, bind `device.boundUserId` (FR-024).
- `claimWithCode(payload)` — logged-in user enters a claim code; when the code is for a
  different account it presents login-or-register; when a reseller, it can assign the
  device directly to their org (FR-005/023).
- `profile()` — current user + membership/role in active org.
- Owner: `listMembers(organizationId)`, `inviteMember(email, role)`,
  `assignDevice(deviceId, memberId)`, `unassignDevice(deviceId)`, `updateMemberRole(...)`.
- Admin: `listOrganizations()` — org list with device counts.

### device

- Public setup: `validateClaimCode(deviceSlug, claimCode)` for `/[slug]/setup`.
- Merchant: `listVisible()` (owner sees org devices; member sees assigned),
  `get(id)`, `claim(claimCode)`, `updateName(id, name)`, `publish(id)`, `unpublish(id)`,
  `reset(id)` (owner keep-org scope).
- Admin: `listAll()`, `create(payload)` (returns `slug` + claim code; accepts optional
  `organizationId` to assign at sale), `disable(id)`, `enable(id)`, `reset(id)`
  (admin clear-org scope), `transfer(id, toOrganizationId?)`.

### destination

- `listForDevice(deviceId)`, `setForDevice(deviceId, destinations[])` (single or
  multi-link, atomic; used by both `/[slug]/setup/redirect` and the dashboard),
  `searchPlaces(query)` (Google Places, server-side only), `generateReviewUrl(placeId)`
  (derived server-side), `toggleActive(destinationId)`.

### scan

- Public resolution is server-side only (see public-scan.md); no client route.
- `listEvents(deviceId, range)` — raw recent events for a device (owner only).

### analytics

- `overview()` — totals + per-day + per-device aggregate (owner only).
- `breakdown(deviceId, dimension)` — browser/deviceType/country/city/referrer counts.

## Validation boundary

Every `payload` above is parsed with a Zod schema from `domains/<schemas>/` before
reaching a service (constitution VII); rejected payloads return field-level errors the
TanStack Form surfaces in the UI. Claim codes are validated by hash comparison against
`device.claimCodeHash`, never by raw equality in logs.