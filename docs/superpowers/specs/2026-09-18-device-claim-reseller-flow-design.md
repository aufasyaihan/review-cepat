# Device claim & reseller flow — design

Status: approved in conversation 2026-09-18, pending spec self-review.

## Context

The device-claim journey (customer scans a device → activation → destination
setup → optional account creation) already has a partial implementation:
- `(redirect)/s/[slug]/setup` — accountless claim-code entry (now using a
  shadcn OTP input, 8-char codes from `generateClaimCode`).
- `(redirect)/s/[slug]/setup/redirect` — accountless destination editor,
  gated by a short-lived HMAC token (`lib/setup-token.ts`).
- `domains/merchant/server/service.ts` — `registerWithClaimCode` /
  `claimWithCode`, both keyed off re-entering the claim code.
- better-auth `organization` plugin already provides `organization`/`member`
  tables with `owner`/`member` roles — no schema change needed for the
  reseller hierarchy.

This spec covers what happens after the claim code is validated (the
owner/reseller branch), the public multi-link landing page shown to
customers when a device has several destinations, and pruning the
dashboard to match each role's allowed pages.

## Flow

### 1. Claim-code validation (`setupClaimCodeAction`, already exists)

Unchanged: validates the code against `device.claimCodeHash` for the slug,
flips `device.status` from `UNCLAIMED` to `CLAIMED`. This is the single
gate that proves the caller physically has the device.

### 2. Post-claim branch (new)

Runs immediately after step 1 succeeds, inside `setupClaimCodeAction`:

| Session? | Device already has an org? | Caller role | Outcome |
|---|---|---|---|
| No | — | — | Redirect to `/s/[slug]/setup/redirect?t=<setup-token>` (today's accountless destination editor, unchanged) |
| Yes | Yes | any | Bind caller into that org directly (device-id variant of `claimWithCode`) → redirect to `/dashboard` |
| Yes | No | owner | Redirect to `/s/[slug]/option` (no destination editor yet) |
| Yes | No | member | Bind caller into their own org directly (same as the "already has an org" row) → redirect to `/dashboard` |

This branch is extracted into one shared function,
`resolvePostClaim(deviceId, userId | null)`, so it can be called both from
`setupClaimCodeAction` (session already present) and from the deferred
login/register path (session created after accountless setup + onboarding).

### 3. Onboarding `?d=` handoff (new)

When the accountless flow reaches `/s/[slug]/onboarding` (new page, not yet
built) and the visitor chooses to register or log in, the "create account" /
"log in" links carry `?d=<token>` where `<token>` is the **same signed
token format** already used by `lib/setup-token.ts` for the setup→redirect
handoff (`base64url({deviceId}.{issuedAtMs}).{hmac}`), not the raw device
id. This prevents an attacker from crafting `?d=<arbitrary-uuid>` to
hijack a device they never proved a claim code for.

- Add `resolveSetupToken(token, now?, key?): string | null` to
  `lib/setup-token.ts` — decodes + verifies without requiring the caller to
  already know the device id (today's `verifySetupToken(token, deviceId)`
  requires it upfront, which doesn't fit `/login?d=...`). Existing function
  is untouched.
- Same 10-minute TTL as the existing setup token — same trust boundary
  (proof of a just-completed claim-code check). If expired, the visitor
  just re-opens the device link to restart.
- `signUpAction`/`signInAction` (or new wrapper actions) accept the
  optional `d` token, resolve it to a device id post-auth, and call
  `resolvePostClaim(deviceId, user.id)` before navigating.

### 4. `/s/[slug]/option` page (new)

Session-gated: redirect to `/login?d=<token>` if no session (same signed
token from step 3, so the session-first entry point round-trips through
login without losing device context — matches existing `proxy.ts`
pattern otherwise). Two cards, each behind an `AlertDialog` confirmation:

- **Claim for yourself** — sets `device.organizationId`/`memberId`/
  `boundUserId` to the caller's, status `CLAIMED`. Any destinations already
  configured (if this device went through accountless setup before the
  owner logged in) are **kept**.
- **Resell** — reuses the existing `adminReset`-style routine: clears
  `destination` rows, nulls `memberId`/`boundUserId`/`organizationId`,
  status back to `UNCLAIMED`, rotates `claimCodeHash`. Destinations are
  **always** wiped here, whether or not accountless setup happened first —
  a resold device must start clean for its next owner.

Both branches redirect to `/dashboard` after the alert-dialog confirmation.

`proxy.ts` needs a matcher entry (or permission-table row) for
`/s/:slug/option` since it's session-gated but outside `(dashboard)`.

### 5. Org auto-creation on plain `/register` (new)

Today, organization creation only happens via admin
(`createOrganizationShell`) or implicitly by `registerWithClaimCode`
joining an *existing* org. A brand-new merchant registering without a
device in hand (the reseller's own signup) needs an org created for them
as owner. `signUpAction` gains: after `auth.api.signUpEmail` +
role promotion, call `auth.api.createOrganization` (caller becomes owner
automatically per better-auth) if the user has no membership yet.

`signUpSchema` gains `phone` (required — `merchantProfile.phone` column
already exists, just unused) and `businessName` becomes **required**
(currently optional).

### 6. `/s/[slug]/links` public multi-link page (new)

Shown when `resolveOutcome` would otherwise be `LANDING_SHOWN` (device
`PUBLISHED`, 2+ active destinations) — today's `LandingClient` on
`/s/[slug]` already covers this case with a plain link list; this
sub-project replaces that list with the richer linktree design:

- Centered card: business name, short description, then a 1–5 star row.
- Tapping any star, **when a `GOOGLE_REVIEW` destination exists**,
  navigates to `deriveReviewUrl(placeId)`
  (`domains/destination/constants.ts`) — confirmed Google has no
  supported prefill-rating param, so all five stars send the visitor to
  the same review URL, which itself auto-redirects into the Google Maps
  app (mobile) or the web review page (desktop). The star value is a
  visual affordance only, not something the link encodes.
- Below the stars: one row per remaining active destination
  (`INSTAGRAM`/`FACEBOOK`/`TIKTOK`/`WHATSAPP`/`WEBSITE`/`CUSTOM_URL`),
  full-width flex-col buttons, icon derived from `destination.type` via
  `react-icons/fa` (new dependency — not in `package.json` yet).
- `LandingClient`/`resolveOutcome`/`buildLandingPayload` stay as the data
  layer; only the presentation changes, so no `domains/scan` changes
  beyond exposing `type` per link (already present in `LandingPayload`).
  Reuses the existing route (`/s/[slug]`) rather than a literal
  `/s/[slug]/links` path, since `resolveOutcome` already branches
  `REDIRECTED` vs `LANDING_SHOWN` vs `INACTIVE` server-side on that one
  route — flag if you specifically want a distinct `/links` URL instead.

### 7. Dashboard route pruning by role (mostly already correct)

Nav is fully data-driven from the `permission`/`role_permission` tables
(`db/seed/permissions.ts`), not hardcoded per role, so most of this is
config changes rather than new gating logic:

- **Already correct, no change needed**: merchant's `devices-client.tsx`
  has no "New device" button (only `admin-devices-client.tsx` does);
  `user-management-client.tsx` already branches `AdminUsersTable` vs.
  `MerchantUsersTable`; `/user-management`'s `LINK_ROWS` entry is already
  `merchantScope: 'owner'` (sub-merchants can't see it, matching "only
  /dashboard, /devices, /settings").
- **Bug to fix**: `/merchants`' `LINK_ROWS` entry has `merchantScope: null`
  (visible to every merchant, owner or member), but the page itself does
  `requireRole('ADMIN')` — a merchant clicking it today hits a
  server-side block after seeing the nav item. Remove the MERCHANT link
  entirely (admin-only nav item).
- **Remove**: the `/devices/claim` permission row (menu + its
  `api.claim_device` child) — claiming now happens through `/s/[slug]` →
  `/option`, not a dashboard page. Delete
  `app/(dashboard)/devices/claim/*`.
- **Remove**: `app/(dashboard)/devices/[id]/*` and
  `app/(dashboard)/user-management/[memberId]/*` route folders. Per-device
  management moves inline onto the `/devices` list: each row gets an
  `EllipsisVertical` dropdown (replacing today's `createActionsColumn`
  row actions) with:
  - **Edit** — opens a dialog (device name + destination editor, reusing
    `DestinationRow`/`components/forms/destination-editor.tsx`, the same
    building block the accountless setup flow uses).
  - **Reset** — confirmation `AlertDialog`, calls the existing
    `ownerReset`/`adminReset`-style routine (clears destinations, rotates
    claim code, keeps the org/member binding).
  - **Forgot device** — confirmation `AlertDialog`; per the original
    claim-flow notes, detaches the device from the account/org (nulls
    `organizationId`/`memberId`/`boundUserId`, status back to
    `UNCLAIMED`, rotates the claim code — functionally the same reset
    routine as the `/option` "resell" branch, just triggered from the
    dashboard instead of the public claim flow).
  Merchant's existing "Reset" action (`devices-client.tsx`, owner-only)
  is superseded by this dropdown, not kept alongside it.

## Data model

No schema changes. `device.status` reuses `UNCLAIMED` for "reseller chose
to resell" — same value as "never claimed," since `organizationId`/
`destination` rows are the actual signal for "has this device ever been
configured," not a separate status.

## Testing

- Unit: `resolvePostClaim` branch table (4 rows above), `resolveSetupToken`
  (valid, expired, tampered, malformed).
- Unit: resell routine clears destinations + rotates code even when none
  existed yet.
- Unit: `LandingClient`/links-page rendering for each destination type's
  icon, and that every star tap navigates to the same `deriveReviewUrl`
  target.
- Unit: `db/seed/permissions.ts` — `/merchants` and `/devices/claim` no
  longer resolve for `MERCHANT` in either org-role scope.
- Unit: `/devices` row dropdown — Edit/Reset/Forgot device call the right
  actions, each confirmation-gated for Reset/Forgot device.
- E2E: extend `tests/e2e/setup-claim.spec.ts` or new spec for the
  session-owner → `/option` → resell → re-claim round trip, and the
  no-session → login (carrying `?d=`) → `/option` round trip.
- E2E: merchant and sub-merchant sidebar contents match the pruned nav
  (no Merchants, no Claim a device; sub-merchant also has no User
  management).
