# Contracts — Accountless Setup & Organization Binding

External contract for the public device setup surface (`/{slug}/setup`,
`/{slug}/setup/redirect`) and the claim-code flows that bind accounts. Full data rules
in [data-model.md](../data-model.md).

## Public setup (no account required — FR-004)

### GET/POST `/{slug}/setup`

1. Route is a server component in the `(redirect)` group — no next-themes provider, no
   auth (FR-034). Center-aligned minimal UI matching the auth screens.
2. The page asks for the device's claim code. `fetch` nothing until the code is
   submitted (validated against `device.claimCodeHash` in `domains/device/server/`).
3. On success the user is forwarded (client `useRouter` after a Server Action, or a
   server-side redirect) to `/{slug}/setup/redirect`. A toast confirms the code was
   accepted (FR-031).
4. Invalid / already-bound / rotated code → inline Zod + server error, no state change.

### GET/POST `/{slug}/setup/redirect`

1. User chooses **single-link** or **multiple-links**.
2. Single: Google Places search input; selecting a place stores a `GOOGLE_REVIEW`
   destination derived server-side from `place_id`; the generated review URL is the
   redirect target.
3. Multiple: Google Places search plus one or more custom/categorized URLs
   (Instagram, Facebook, TikTok, WhatsApp, website, custom); stored as ordered
   destinations.
4. Submitting configures the device (status → `CLAIMED`; destinations stored) and
   redirects to a completion screen (a simple success card + link to the scan URL).
   The device can then publish; `boundUserId` remains null until the merchant registers.
5. A success toast and a skeleton/loading state are shown throughout (FR-031/033).

## Claim-code account flows (FR-001/005/023/024)

The claim code is a long-lived per-device secret. It is the same code for setup and for
account binding; it never changes except on reset (FR-028).

| Path | Who | Behavior |
|------|-----|----------|
| Register with claim code (dashboard/register) | New user, no account | Create account; if `device.boundUserId` is null → join the device's `organizationId` as `member`, set `device.boundUserId` (FR-024). If bound → reject "code already used". |
| Login with claim code | Existing user | Sign in, set `device.boundUserId`, attach the device to that account (FR-005). |
| Claim from dashboard (logged in) | Reseller | Present login-or-register if the code belongs to another account; otherwise add device to their org directly — no separate login step (FR-005/023). |
| Assign at reseller sale (dashboard) | Reseller | `assignDevice(deviceId, memberId)` sets `device.memberId`; the device then appears on both the member's and the owner's dashboards (FR-025/027). |

### Who sees the device

- Owner (reseller): every device with `device.organizationId` in their org.
- Member (sub-merchant): only devices where `device.memberId` matches their member row.
- No account / accountless setup: the device is org-owned; it appears on the owner's
  dashboard immediately after setup (member assignment optional).

## Reset scopes (FR-028)

- **Owner reset** (`device.reset`): clear destinations, null `memberId` + `boundUserId`,
  keep `organizationId`, rotate claim code. Device returns to `CLAIMED` and needs
  re-setup.
- **Admin reset**: additionally clear `organizationId` (back to unclaimed/admin-owned)
  and rotate the claim code.

## Error cases

- Unknown slug → `notFound()` (404).
- Wrong/invalid/rotated claim code → inline error, no mutation.
- Code already bound to another account on registration → "This code is already linked
  to an account" with a login option.
- Setup on a device that is DISABLED → inactive-style message (FR-015).