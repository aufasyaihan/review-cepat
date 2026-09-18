# Admin access to /user-management

## Problem

`/user-management` (`app/(dashboard)/user-management/page.tsx`) is visible in
the sidebar for `ADMIN` users — the `permission` table already grants
`ADMIN` the `/user-management`, `/api/member/invite`, `/api/member/assign`,
and `/api/member/unassign` rows (`db/seed/permissions.ts`). But the page
guard is `requireRole('MERCHANT')`, so an admin who clicks the link is
redirected to `/`. The org-scoped member-management flow (invite a
sub-merchant, assign/unassign devices) was built only for a `MERCHANT`
organization owner — it derives the target organization from the caller's
own Better Auth membership, which an `ADMIN` doesn't have.

This spec closes that gap: `ADMIN` gets full parity (view, invite, assign,
unassign) across every organization, without changing the existing
owner-only behavior for `MERCHANT` users.

## Non-goals

- No change to who *can* be invited/assigned within an org (still Better
  Auth org invite semantics).
- No new permission-table rows — the existing `ADMIN` rows already
  anticipate this.
- No change to the `member`/`organization` role model.

## Data layer (`domains/merchant/server/service.ts`)

- `MemberWithUser` gains `organizationId: string` and
  `organizationName: string`. `listMembers(organizationId)` joins
  `organization` to populate them (owner view doesn't need to show them, but
  a single shared shape keeps the API/client uniform).
- New `listAllMembers(): Promise<MemberWithUser[]>` — same shape as
  `listMembers`, across every organization (no `where` on org).
- New `getMemberById(memberId): Promise<MemberWithUser | null>` — admin-only
  lookup for the detail page, since an admin has no "own org" to search
  `listMembers` within.

## API (`app/api/merchant/members/route.ts`)

- Guard becomes `requireApiUser(['ADMIN', 'MERCHANT'])`.
- `ADMIN` → `listAllMembers()`.
- `MERCHANT` → existing behavior unchanged: 403 unless the caller is the org
  owner, then `listMembers(ownOrgId)`.

## Actions (`domains/merchant/server/member-actions.ts`)

- `inviteMemberAction`, `assignDeviceAction`, `unassignDeviceAction` each
  gain an optional `organizationId` input.
- New helper resolves the acting organization:
  - `MERCHANT`: unchanged — derived from the caller's own membership via
    `requireOwnerMembership`. Any client-supplied `organizationId` is
    ignored (an owner cannot act on another org).
  - `ADMIN`: `organizationId` is required from the input. The existing
    `assertDeviceInOrg` / `assertMemberInOrg` checks inside
    `service.ts#assignDevice`/`unassignDevice` (and an equivalent org-exists
    check for invite) validate it's real — the admin isn't trusted blindly,
    the org id is just how they specify scope.
- `requireApiPermission` already resolves `ADMIN` via `roleMatches` (role
  match short-circuits before the `orgRole` scoping check), so no changes
  needed there.

## Pages

### `user-management/page.tsx`

- Guard becomes `requireRole(['ADMIN', 'MERCHANT'])`.
- `ADMIN`: skip the `getActiveOrganization`/`isOwner` check entirely (no
  membership to check). Prefetch `memberKeys.list()` (→ `listAllMembers`
  via the branching API route) and `adminKeys.organizations()` (→
  `listOrganizations`, already used on `/devices`) for the filter/invite
  selects. No device-list prefetch here (unnecessary at the list level for
  admin, same as it already only exists on the owner path for cache
  warm-up).
- `MERCHANT`: unchanged.

### `user-management/[memberId]/page.tsx`

- Guard becomes `requireRole(['ADMIN', 'MERCHANT'])`.
- `ADMIN`: `getMemberById(memberId)`, 404 if missing. Build a synthetic
  `{ id: '', organizationId: member.organizationId, role: 'owner' }`
  membership to reuse `listVisible` for the device prefetch (the `owner`
  branch of `orgAccessWhere` never reads `id`, so the empty id is inert).
- `MERCHANT`: unchanged.

## UI

### `user-management-client.tsx`

- New props: `isAdmin: boolean`, `organizations: OrganizationWithDevices[]`.
- Admin only:
  - An "Organization" column in the members table.
  - A view filter `Select` in the datatable header ("All organizations" +
    one entry per org) that narrows the client-side `members` array. Purely
    a display filter — admin sees every org's members by default, filtering
    is optional and never blocks anything else on the page.
  - The invite form gets its own `Select` for the target organization,
    independent of the view filter (required to submit — there's no
    implicit "current org" for an admin). Mirrors the org `Select` already
    used in `admin-devices-client.tsx`'s create-device dialog.
- `MERCHANT` owner path is visually unchanged (no org column, no filter, no
  org select in the invite form).

### `member-detail-client.tsx`

- The existing `organizationId` prop (currently unused) is now passed
  through in the `assignDeviceAction`/`unassignDeviceAction` mutate calls.
  No-op for the `MERCHANT` path (server ignores it there); required for the
  `ADMIN` path.

## Testing

- Unit: `listAllMembers`, `getMemberById`, the action-level org resolution
  (admin with/without `organizationId`, owner ignoring a spoofed
  `organizationId`), `/api/merchant/members` role branching.
- E2E: admin visits `/user-management` without redirect, sees members from
  multiple orgs, filters by org, invites into a chosen org, assigns/unassigns
  a device for a member in an org the admin doesn't belong to. Existing
  owner/member e2e specs (`owner-dashboard.spec.ts`,
  `sub-merchant-access.spec.ts`) must keep passing unchanged.
