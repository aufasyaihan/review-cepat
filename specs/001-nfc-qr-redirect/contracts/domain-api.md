# Contracts — Domain API Surface

Internal contract: client components talk ONLY to their domain's API layer
(`domains/<name>/api/{queries,mutations}.ts`); route handlers translate HTTP into
`domains/<name>/server/service.ts`. No component or hook calls `fetch()` directly
(constitution III, architecture rule 9). Tables/fields per [data-model.md](../data-model.md).
Route groups: four — `(auth)`, `(dashboard)` (all roles, root paths), `(landing-page)`,
`(redirect)`.

## Public routes (external)

### `app/api/auth/[...all]/route.ts`

Better Auth route handler (POST/GET passthrough): sign-in, sign-up, session, sign-out,
plus organization endpoints (list members, set active org, assign role). No business
logic beyond translation. Org roles (`owner` | `member`) enforced at domain permissions,
not here. **No invite flow is used** (FR-022): the org plugin's invitation endpoints
exist but the user-management UI exposes no invite/add-member action.

### `app/[slug]/setup` and `app/[slug]/setup/redirect`

Accountless device setup (in the `(redirect)` group) — see [setup-claim.md](setup-claim.md).
No theme provider, no auth required (FR-004).

### `app/s/[slug]/*`

Public device resolution (in the `(redirect)` group) — see [public-scan.md](public-scan.md).

## Domain API operations (client → route handler → domain service)

### auth

- `me()` — current session + role + active organization(s) (guards UI).
- `GET /api/permissions` (authenticated) — the caller's own permitted nav items
  (`is_menu=true`) and API paths from `role_permission` links, ordered by `sort`
  (FR-036/037/042). Rendered client-side into the sidebar with a phantom-ui skeleton;
  `layout.tsx` never fetches nav server-side (FR-043). For ADMIN it returns every
  permission row (admin links are seeded; guards additionally short-circuit).
- `GET /api/roles/:roleId/permissions` (admin-only) — a role's permission mapping for
  permission administration and seed verification (FR-042).
- `can(role, orgRole, path)` — ADMIN always `true` (superuser, no DB lookup; FR-041);
  otherwise true when a `role_permission` link matches the role and (when the link has
  a `scope`) the orgRole. Enforces page access in proxy.ts (FR-036) and API access via
  `requireApiPermission(path)` in every guarded Server Action / route handler (FR-037).
  API-endpoint rows use `is_menu=false`, `path` = the endpoint
  (e.g. `/api/device/create`), a dotted label (`api.create_device`), and
  `parent_id` → the page row they serve (Clarification 2026-09-16).
- (Better Auth client handles sign-in/sign-up/sign-out/session/org invitations.)

### merchant (organization + members)

- `registerWithClaimCode(payload)` — accountless-claimed device: create account, join
  the device's `organizationId` as `member`, bind `device.boundUserId` (FR-024).
- `claimWithCode(payload)` — logged-in user enters a claim code; when the code is for a
  different account it presents login-or-register; when a reseller, it can assign the
  device directly to their org (FR-005/023).
- `profile()` — current user + membership/role in active org.
- Owner: `listMembers(organizationId)`, `assignDevice(deviceId, memberId)`,
  `unassignDevice(deviceId)`, `updateMemberRole(...)`, `removeMember(memberId)` —
  **no invite/add-member op**; members join only via claim-code self-registration
  (FR-022). Row actions per FR-045: user-management Edit → `updateMemberRole`/
  `profile` edits; Delete → `removeMember`.
- Admin:
  - `listUsers({ q?, organizationId?, page?, limit? })` — **server-driven** admin
    user list (debounced): search `q`, merchant-filter `organizationId`, server-side
    pagination `page`/`limit` (FR-052/055). Route: `GET /api/members`.
  - `createUser(payload)` — name/email/password + org + role (owner/member); no email
    invitation (FR-052). Route: `POST /api/members`.
  - `updateUser(memberId, payload)` — name, email, role, org reassignment (move user
    between organizations — FR-053), device assign/disassign (FR-052). Route:
    `PATCH /api/members/:memberId`.
  - `deleteUser(memberId)` — removes membership + deactivates platform account
    (last-owner protected) (FR-052). Route: `DELETE /api/members/:memberId`.
  - `listOrganizations({ q?, page?, limit? })` — **server-driven** admin merchant list
    (debounced search + server-side pagination; user-facing label "merchants", FR-047).
    Route: `GET /api/organizations` (FR-054/055).
  - `createOrganization(payload)` — org shell (business name only; no owner assigned
    at creation) (FR-054). Route: `POST /api/organizations`.
  - `updateOrganization(organizationId, payload)` — business name + assign owner from
    existing accounts (FR-054). Route: `PATCH /api/organizations/:id`.
  - `deleteOrganization(organizationId)` — removes the merchant org (devices/members
    handling per confirmation dialog) (FR-054). Route: `DELETE /api/organizations/:id`.
  - Merchant combobox options (user-management filter) load via **TanStack Query
    `useInfiniteQuery`** against `GET /api/organizations` (debounced `q`, `page`,
    `limit`) — never `prefetchQuery`, never client-filtered (FR-056).
- (Device edit "Edit" row action opens an in-place dialog and MUST NOT navigate to
  `/devices/[id]` — FR-040; Settings session "Revoke all others"/revoke is gated by an
  `AlertDialog` confirmation — FR-039.)

### device

- Public setup: `validateClaimCode(deviceSlug, claimCode)` for `/[slug]/setup`.
- Merchant: `listVisible()` (owner sees org devices; member sees assigned),
  `get(id)`, `claim(claimCode)`, `updateName(id, name)`, `publish(id)`, `unpublish(id)`,
  `reset(id)` (owner keep-org scope). Device-row actions per FR-045: Edit →
  `updateName`/destination config; Reset → `reset` (owner).
- Admin: `listAll()`, `create(payload)` (returns `slug` + claim code; accepts optional
  `organizationId` to assign at sale), `disable(id)`, `enable(id)`, `reset(id)`
  (admin clear-org scope), `transfer(id, toOrganizationId?)`, `delete(id)` (admin-only
  soft delete — sets `deleted` status; FR-040/045 device-row Delete).

### destination

- `listForDevice(deviceId)`, `setForDevice(deviceId, destinations[])` (single or
  multi-link, atomic; used by both `/[slug]/setup/redirect` and the dashboard),
  `searchPlaces(query)` (Google Places, server-side only), `generateReviewUrl(placeId)`
  (derived server-side), `toggleActive(destinationId)`.

### scan

- Public resolution is server-side only (see public-scan.md); no client route.
- `listEvents(deviceId, range)` — raw recent events for a device (owner only).

### analytics

- `overview(from?, to?)` — totals + per-day + per-device aggregate (owner only),
  filtered by date range when `from`/`to` provided (FR-044).
- `adminOverview(from?, to?)` — aggregates across ALL merchants' devices for the admin
  dashboard date-filtered view; includes merchant count and user count summary metrics
  (FR-044, FR-051).
- `breakdown(deviceId, dimension)` — browser/deviceType/country/city/referrer counts.

## Validation boundary

Every `payload` above is parsed with a Zod schema from `domains/<schemas>/` before
reaching a service (constitution VII); rejected payloads return field-level errors the
TanStack Form surfaces in the UI. Claim codes are validated by hash comparison against
`device.claimCodeHash`, never by raw equality in logs.