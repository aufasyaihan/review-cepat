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

This spec covers the remaining piece: what happens after the claim code is
validated, when the device has no organization yet, and the caller may or
may not already have a session — including the reseller "claim for
yourself vs. resell" decision.

## Out of scope

- `/s/[slug]/links` public multi-link landing page (star rating + linktree).
- Dashboard route pruning by role (`/devices/[id]`, `/devices/claim`,
  `/user-management/[memberId]` removal; merchant/sub-merchant nav limits).

Both remain queued as separate sub-projects.

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

Session-gated (redirect to `/login` if no session — matches existing
`proxy.ts` pattern). Two cards, each behind an `AlertDialog` confirmation:

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
- E2E: extend `tests/e2e/setup-claim.spec.ts` or new spec for the
  session-owner → `/option` → resell → re-claim round trip.
