# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `ADMIN` users reach `/user-management` (currently redirects them to `/`) and view/invite/assign/unassign members across every organization, with full parity to what an org owner can do for their own org.

**Architecture:** Extend the existing owner-scoped member-management stack (service functions, server actions, the two pages, the two client components) to branch on caller role instead of building a parallel admin-only feature. `MERCHANT` owners keep deriving their organization from their own Better Auth membership (unchanged); `ADMIN` supplies an explicit `organizationId` that server-side org-membership assertions (`assertDeviceInOrg`/`assertMemberInOrg`, already in `service.ts`) validate.

**Tech Stack:** Next.js App Router (server components + server actions), Drizzle ORM (MySQL), TanStack Query (client data), Zod (validation), Vitest (unit tests), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-09-16-admin-user-management-design.md`

## Global Constraints

- `MERCHANT` owner behavior must not change: same error messages, same data, same UI for that role in existing tests (`tests/unit/merchant/member-actions.test.ts`, `tests/unit/merchant/member.service.test.ts`, `tests/e2e/owner-dashboard.spec.ts`, `tests/e2e/sub-merchant-access.spec.ts`).
- `domains/**` and `lib/**` must stay at or above 90% statements/branches/functions/lines (`vitest.config.mts` coverage thresholds) — every new branch in `service.ts` and `member-actions.ts` needs a unit test. `app/**` (pages, API routes, client components) has no coverage threshold and no existing route-handler unit tests — rely on e2e for that layer, matching the existing pattern (no test file exists for `app/api/merchant/members/route.ts` or `app/api/admin/organizations/route.ts` today).
- An `ADMIN`-supplied `organizationId` is never trusted blindly — it only ever narrows a query that's already re-validated server-side (`assertDeviceInOrg`, `assertMemberInOrg`, or Better Auth's own `inviteMember` org lookup). A `MERCHANT` owner's client-supplied `organizationId` is always ignored in favor of their own membership.
- Follow existing conventions: `ActionResult<T>` (`lib/action-result.ts`) for server actions, `apiRoute` (`lib/api.ts`) for route handlers, TanStack Query key factories (`domains/*/api/queries.ts`), the `Select`/`DataTable` component patterns already used in `admin-devices-client.tsx`.

---

### Task 1: Service layer — cross-org member queries

**Files:**
- Modify: `domains/merchant/server/service.ts:279-322` (the `MemberWithUser` type and `listMembers`)
- Test: `tests/unit/merchant/member.service.test.ts`

**Interfaces:**
- Produces: `MemberWithUser` now includes `organizationId: string` and `organizationName: string`. `listAllMembers(): Promise<MemberWithUser[]>`. `getMemberById(memberId: string): Promise<MemberWithUser | null>`. All three functions (`listMembers`, `listAllMembers`, `getMemberById`) share the owner-first sort and device-count logic via two new unexported helpers, `toMemberWithUser` and `memberDeviceCounts`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/merchant/member.service.test.ts` (the mock at the top already has `q('member').findMany`/`findFirst`; extend fixture rows with `organizationId`/`organization` so the new fields resolve):

```ts
// Update every member fixture in this file's existing `listMembers` tests to
// also include organizationId/organization, e.g.:
//   {
//     id: 'm-owner',
//     organizationId: 'org-1',
//     userId: 'u1',
//     role: 'owner',
//     organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
//     user: { id: 'u1', name: 'Owner', email: 'owner@acme.io', ... },
//   }
// and assert the new fields in the existing `toMatchObject` checks, e.g.:
//   expect(members.find((m) => m.id === 'm-sub')).toMatchObject({
//     role: 'member',
//     email: 'sub@acme.io',
//     deviceCount: 2,
//     organizationId: 'org-1',
//     organizationName: 'Org One',
//   });

describe('listAllMembers', () => {
  it('returns members across every organization, owner-first per group, with org fields', async () => {
    q('member').findMany.mockResolvedValue([
      {
        id: 'm-sub-2',
        organizationId: 'org-2',
        userId: 'u4',
        role: 'member',
        organization: { id: 'org-2', name: 'Org Two', slug: 'org-two' },
        user: { id: 'u4', name: 'Sub Two', email: 'sub2@acme.io' },
      },
      {
        id: 'm-owner-1',
        organizationId: 'org-1',
        userId: 'u1',
        role: 'owner',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: { id: 'u1', name: 'Owner One', email: 'owner1@acme.io' },
      },
    ]);

    const members = await listAllMembers();
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.id === 'm-sub-2')).toMatchObject({
      organizationId: 'org-2',
      organizationName: 'Org Two',
      deviceCount: 0,
    });
    expect(members.find((m) => m.id === 'm-owner-1')).toMatchObject({
      organizationId: 'org-1',
      organizationName: 'Org One',
    });
  });

  it('returns an empty list when there are no members anywhere', async () => {
    const members = await listAllMembers();
    expect(members).toEqual([]);
  });
});

describe('getMemberById', () => {
  it('returns the member with org fields and device count when found', async () => {
    q('member').findFirst.mockResolvedValue({
      id: 'm-sub',
      organizationId: 'org-1',
      userId: 'u2',
      role: 'member',
      organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
      user: { id: 'u2', name: 'Sub', email: 'sub@acme.io' },
    });
    q('device').findMany.mockResolvedValue([{ id: 'd1', memberId: 'm-sub' } as never]);
    selectGroupBy().mockResolvedValue([{ memberId: 'm-sub', cnt: 1 }]);

    const found = await getMemberById('m-sub');
    expect(found).toMatchObject({
      id: 'm-sub',
      organizationId: 'org-1',
      organizationName: 'Org One',
      deviceCount: 1,
    });
  });

  it('returns null when the member does not exist', async () => {
    q('member').findFirst.mockResolvedValue(null);
    const found = await getMemberById('missing');
    expect(found).toBeNull();
  });
});
```

Update the import line to add the new functions:

```ts
import {
  assignDevice,
  getMemberById,
  listAllMembers,
  listMembers,
  unassignDevice,
} from '@/domains/merchant/server/service';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/merchant/member.service.test.ts`
Expected: FAIL — `listAllMembers`/`getMemberById` not exported, and the updated `toMatchObject` assertions fail on missing `organizationId`/`organizationName`.

- [ ] **Step 3: Implement**

Replace `domains/merchant/server/service.ts:279-314` (the `MemberWithUser` type through the end of `listMembers`) with:

```ts
export type MemberWithUser = {
  id: string;
  role: 'owner' | 'member';
  name: string;
  email: string;
  deviceCount: number;
  organizationId: string;
  organizationName: string;
};

type MemberRow = {
  id: string;
  role: string;
  organizationId: string;
  organization: { name: string };
  user: { name: string; email: string };
};

function toMemberWithUser(row: MemberRow, deviceCount: number): MemberWithUser {
  return {
    id: row.id,
    role: row.role as MemberWithUser['role'],
    name: row.user.name,
    email: row.user.email,
    deviceCount,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
  };
}

async function memberDeviceCounts(): Promise<Map<string, number>> {
  const counts = await getDb()
    .select({ memberId: device.memberId, cnt: count() })
    .from(device)
    .where(isNotNull(device.memberId))
    .groupBy(device.memberId);
  const countByMember = new Map<string, number>();
  for (const c of counts) {
    if (c.memberId !== null) countByMember.set(c.memberId, c.cnt);
  }
  return countByMember;
}

function sortOwnerFirst(members: MemberWithUser[]): MemberWithUser[] {
  return members.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0));
}

/** Owner view: every member of an organization with assigned-device counts. */
export async function listMembers(organizationId: string): Promise<MemberWithUser[]> {
  const rows = await getDb().query.member.findMany({
    where: eq(member.organizationId, organizationId),
    with: { user: true, organization: true },
  });
  const countByMember = await memberDeviceCounts();
  return sortOwnerFirst(rows.map((r) => toMemberWithUser(r, countByMember.get(r.id) ?? 0)));
}

/** Admin view: every member across every organization (FR-021/022, admin parity). */
export async function listAllMembers(): Promise<MemberWithUser[]> {
  const rows = await getDb().query.member.findMany({ with: { user: true, organization: true } });
  const countByMember = await memberDeviceCounts();
  return sortOwnerFirst(rows.map((r) => toMemberWithUser(r, countByMember.get(r.id) ?? 0)));
}

/** Admin view: a single member in any organization, for the detail page. */
export async function getMemberById(memberId: string): Promise<MemberWithUser | null> {
  const row = await getDb().query.member.findFirst({
    where: eq(member.id, memberId),
    with: { user: true, organization: true },
  });
  if (!row) return null;
  const countByMember = await memberDeviceCounts();
  return toMemberWithUser(row, countByMember.get(row.id) ?? 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/merchant/member.service.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full unit suite with coverage**

Run: `npx vitest run --coverage`
Expected: PASS, `domains/**` coverage still ≥90% across all four metrics.

- [ ] **Step 6: Commit**

```bash
git add domains/merchant/server/service.ts tests/unit/merchant/member.service.test.ts
git commit -m "feat: add cross-org member queries for admin user management"
```

---

### Task 2: Action layer — admin-scoped invite/assign/unassign

**Files:**
- Modify: `domains/merchant/server/member-actions.ts`
- Test: `tests/unit/merchant/member-actions.test.ts`

**Interfaces:**
- Consumes: `listAllMembers`/`getMemberById` are not used here (only Task 1's type change to `MemberWithUser` matters indirectly). Uses existing `requireApiPermission`, `getActiveOrganization`, `isOwner`, `assignDevice`, `unassignDevice`.
- Produces: `inviteMemberAction(input: { email: string; role: 'owner' | 'member'; organizationId?: string })`, `assignDeviceAction(deviceId: string, memberId: string, organizationId?: string)`, `unassignDeviceAction(deviceId: string, organizationId?: string)` — all still `Promise<ActionResult<void>>`, all still `revalidatePath` the same paths as before.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/merchant/member-actions.test.ts`, inside (or after) the existing `describe('member actions (owner-gated)', ...)` block.

**Important:** the production code in `member-actions.ts` gates through `requireApiPermission`, not `requireApiUser` (`requireApiUser` isn't even imported there — it's a vestigial mock in this test file's `vi.mock('@/lib/session', ...)` factory). The file's top-level `beforeEach` only overrides `requireApiUser`'s resolved value; `requireApiPermission`'s resolved value comes from the `vi.mock` factory (`{ id: 'u1', role: 'MERCHANT' }`) and is never reset by `vi.clearAllMocks()` (that clears call history, not the mock implementation), so it stays `MERCHANT` for every test unless a test overrides it directly. Add `requireApiPermission` to this file's import line from `@/lib/session` (alongside the existing `requireApiUser` import) so the new tests can override it:

```ts
import { requireApiPermission, requireApiUser } from '@/lib/session';
```

```ts
describe('member actions (admin)', () => {
  beforeEach(() => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'admin1', role: 'ADMIN' } as never);
  });

  it('invites into the organization the admin specifies', async () => {
    const result = await inviteMemberAction({
      email: 'new@x.com',
      role: 'member',
      organizationId: 'org-9',
    });
    expect(result.ok).toBe(true);
    expect(inviteMember).toHaveBeenCalledWith({
      body: { email: 'new@x.com', role: 'member', organizationId: 'org-9' },
    });
  });

  it('rejects invite when the admin supplies no organizationId', async () => {
    const result = await inviteMemberAction({ email: 'new@x.com', role: 'member' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('organization');
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it('assigns a device in the organization the admin specifies', async () => {
    vi.mocked(assignDevice).mockResolvedValue(undefined as never);
    const result = await assignDeviceAction('d1', 'm1', 'org-9');
    expect(result.ok).toBe(true);
    expect(assignDevice).toHaveBeenCalledWith('d1', 'm1', 'org-9');
  });

  it('rejects assign when the admin supplies no organizationId', async () => {
    const result = await assignDeviceAction('d1', 'm1');
    expect(result.ok).toBe(false);
    expect(assignDevice).not.toHaveBeenCalled();
  });

  it('unassigns a device in the organization the admin specifies', async () => {
    vi.mocked(unassignDevice).mockResolvedValue(undefined as never);
    const result = await unassignDeviceAction('d1', 'org-9');
    expect(result.ok).toBe(true);
    expect(unassignDevice).toHaveBeenCalledWith('d1', 'org-9');
  });

  it('rejects unassign when the admin supplies no organizationId', async () => {
    const result = await unassignDeviceAction('d1');
    expect(result.ok).toBe(false);
    expect(unassignDevice).not.toHaveBeenCalled();
  });
});

describe('member actions (owner cannot spoof another org)', () => {
  it('ignores a client-supplied organizationId and uses the caller\'s own org', async () => {
    vi.mocked(assignDevice).mockResolvedValue(undefined as never);
    const result = await assignDeviceAction('d1', 'm1', 'someone-elses-org');
    expect(result.ok).toBe(true);
    expect(assignDevice).toHaveBeenCalledWith('d1', 'm1', 'org-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/merchant/member-actions.test.ts`
Expected: FAIL — admin calls currently 403/fail because `requireOwnerMembership` always requires the caller's own owner membership regardless of role, and `organizationId` isn't accepted as an input.

- [ ] **Step 3: Implement**

In `domains/merchant/server/member-actions.ts`:

Change the import line to include the `SessionUser` type:

```ts
import { type SessionUser, requireApiPermission } from '@/lib/session';
```

Replace the `inviteSchema` definition:

```ts
const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['owner', 'member'], { message: 'Role must be owner or member' }),
  organizationId: z.string().trim().min(1).optional(),
});
```

Replace `requireOwnerMembership` with:

```ts
/**
 * Resolves the organization a member-management action should operate on.
 * MERCHANT owners always act on their own org (any client-supplied
 * organizationId is ignored — they can't spoof another org). ADMIN has no
 * membership of their own, so they must supply one explicitly; it's
 * re-validated by the org-scoped assertions in service.ts / Better Auth's
 * own org lookup, never trusted blindly.
 */
async function resolveOrganizationId(
  user: SessionUser,
  organizationId?: string,
): Promise<string | null> {
  if (user.role === 'ADMIN') return organizationId ?? null;
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) return null;
  return membership.organizationId;
}
```

Replace `inviteMemberAction`:

```ts
/** Owner or admin invites a sub-merchant to an organization (FR-022). */
export async function inviteMemberAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid invitation');

  const user = await requireApiPermission('/api/member/invite');
  const organizationId = await resolveOrganizationId(user, parsed.data.organizationId);
  if (!organizationId) {
    return fail(
      user.role === 'ADMIN'
        ? 'Select an organization to invite into'
        : 'Only an organization owner can invite members',
    );
  }

  try {
    const orgApi = auth.api as unknown as {
      inviteMember: (opts: {
        body: { email: string; role: string; organizationId: string };
      }) => Promise<unknown>;
    };
    await orgApi.inviteMember({
      body: { email: parsed.data.email, role: parsed.data.role, organizationId },
    });
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not send invitation');
  }
}
```

Replace `assignDeviceAction`:

```ts
/** Owner or admin assigns a device to a sub-merchant member (FR-027). */
export async function assignDeviceAction(
  deviceId: string,
  memberId: string,
  organizationId?: string,
): Promise<ActionResult<void>> {
  const user = await requireApiPermission('/api/member/assign');
  const orgId = await resolveOrganizationId(user, organizationId);
  if (!orgId) {
    return fail(
      user.role === 'ADMIN'
        ? 'Select an organization to assign devices in'
        : 'Only an organization owner can assign devices',
    );
  }

  try {
    await assignDevice(deviceId, memberId, orgId);
    revalidatePath('/devices');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not assign device');
  }
}
```

Replace `unassignDeviceAction`:

```ts
export async function unassignDeviceAction(
  deviceId: string,
  organizationId?: string,
): Promise<ActionResult<void>> {
  const user = await requireApiPermission('/api/member/unassign');
  const orgId = await resolveOrganizationId(user, organizationId);
  if (!orgId) {
    return fail(
      user.role === 'ADMIN'
        ? 'Select an organization to unassign devices in'
        : 'Only an organization owner can unassign devices',
    );
  }

  try {
    await unassignDevice(deviceId, orgId);
    revalidatePath('/devices');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not unassign device');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/merchant/member-actions.test.ts`
Expected: PASS — all existing owner-path tests still pass unchanged, all new admin-path and spoof-prevention tests pass.

- [ ] **Step 5: Run the full unit suite with coverage**

Run: `npx vitest run --coverage`
Expected: PASS, `domains/**` coverage still ≥90%.

- [ ] **Step 6: Commit**

```bash
git add domains/merchant/server/member-actions.ts tests/unit/merchant/member-actions.test.ts
git commit -m "feat: let admin invite/assign/unassign members across organizations"
```

---

### Task 3: API route — serve all members to admin

**Files:**
- Modify: `app/api/merchant/members/route.ts`

**Interfaces:**
- Consumes: `listAllMembers` and `listMembers` from `domains/merchant/server/service.ts` (Task 1).
- Produces: `GET /api/merchant/members` returns `MemberWithUser[]` for both `ADMIN` (all orgs) and `MERCHANT` owner (own org) callers; still 403s a non-owner `MERCHANT`.

No dedicated unit test for this file — no route-handler unit tests exist anywhere in this repo (`app/**` isn't in the coverage `include` list); the branching is exercised end-to-end in Task 8.

- [ ] **Step 1: Implement**

Replace the full contents of `app/api/merchant/members/route.ts`:

```ts
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { listAllMembers, listMembers, type MemberWithUser } from '@/domains/merchant/server/service';
import { apiRoute } from '@/lib/api';
import { ForbiddenError } from '@/lib/errors';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/merchant/members', async (): Promise<MemberWithUser[]> => {
  const user = await requireApiUser(['ADMIN', 'MERCHANT']);
  if (user.role === 'ADMIN') return listAllMembers();

  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    throw new ForbiddenError('MEMBERS_DENIED', 'Only organization owners can list members');
  }
  return listMembers(membership.organizationId);
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/merchant/members/route.ts
git commit -m "feat: serve all-org member list to admin callers"
```

---

### Task 4: List page — admin access and org prefetch

**Files:**
- Modify: `app/(dashboard)/user-management/page.tsx`

**Interfaces:**
- Consumes: `listOrganizations` (`domains/merchant/server/service.ts`, pre-existing), `adminKeys` (`domains/admin/api/queries.ts`, pre-existing), `requireRole` (`lib/session.ts`, pre-existing, already supports `Role[]`). Task 6's `UserManagementClient` will accept `isAdmin: boolean` and `organizations: OrganizationWithDevices[]` props — this task passes them.
- Produces: page no longer redirects `ADMIN` to `/`.

- [ ] **Step 1: Implement**

Replace the full contents of `app/(dashboard)/user-management/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { adminKeys } from '@/domains/admin/api/queries';
import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible } from '@/domains/device/server/service';
import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { listOrganizations } from '@/domains/merchant/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { UserManagementClient } from './user-management-client';

export const dynamic = 'force-dynamic';

export default async function UserManagementPage() {
  const user = await requireRole(['ADMIN', 'MERCHANT']);

  if (user.role === 'ADMIN') {
    const organizations = await listOrganizations();
    const queryClient = getQueryClient();
    await queryClient.prefetchQuery({
      queryKey: memberKeys.list(),
      queryFn: () => memberQueries.list().queryFn(),
    });
    await queryClient.prefetchQuery({
      queryKey: adminKeys.organizations(),
      queryFn: () => organizations,
    });

    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <UserManagementClient isAdmin organizations={organizations} />
      </HydrationBoundary>
    );
  }

  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    // Sub-merchants have no member management (SC-008).
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">User management</h1>
        <p className="text-sm text-muted-foreground">
          Only organization owners can manage members.
        </p>
      </div>
    );
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: memberKeys.list(),
    queryFn: () => memberQueries.list().queryFn(),
  });
  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => listVisible(membership),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserManagementClient isAdmin={false} organizations={[]} />
    </HydrationBoundary>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `user-management-client.tsx` (props not accepted yet — fixed in Task 6). If Task 6 lands first in your execution order, expect no errors here.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/user-management/page.tsx"
git commit -m "feat: let admin load /user-management across all organizations"
```

---

### Task 5: Detail page — admin access via getMemberById

**Files:**
- Modify: `app/(dashboard)/user-management/[memberId]/page.tsx`

**Interfaces:**
- Consumes: `getMemberById` (Task 1), `listVisible` (`domains/device/server/service.ts`, pre-existing, takes a `MembershipLike = { id, organizationId, role }`).
- Produces: page no longer redirects `ADMIN` to `/`; 404s for an admin visiting an unknown `memberId`, same as the owner path already does.

- [ ] **Step 1: Implement**

Replace the full contents of `app/(dashboard)/user-management/[memberId]/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';

import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible, type MembershipLike } from '@/domains/device/server/service';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { getMemberById, listMembers, type MemberWithUser } from '@/domains/merchant/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { MemberDetailClient } from './member-detail-client';

export const dynamic = 'force-dynamic';

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const user = await requireRole(['ADMIN', 'MERCHANT']);

  let member: MemberWithUser;
  let membership: MembershipLike;

  if (user.role === 'ADMIN') {
    const found = await getMemberById(memberId);
    if (!found) notFound();
    member = found;
    membership = { id: '', organizationId: found.organizationId, role: 'owner' };
  } else {
    const ownMembership = await getActiveOrganization(user.id);
    if (!ownMembership || !isOwner(ownMembership)) redirect('/user-management');
    membership = ownMembership;

    const members = await listMembers(ownMembership.organizationId);
    const found = members.find((m) => m.id === memberId);
    if (!found) notFound();
    member = found;
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => listVisible(membership),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MemberDetailClient member={member} organizationId={membership.organizationId} />
    </HydrationBoundary>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/user-management/[memberId]/page.tsx"
git commit -m "feat: let admin open a member's device-assignment page in any org"
```

---

### Task 6: List page UI — org column, view filter, invite target

**Files:**
- Modify: `app/(dashboard)/user-management/user-management-client.tsx`

**Interfaces:**
- Consumes: `OrganizationWithDevices` (`domains/merchant/server/service.ts`, pre-existing), `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` (`@/components/ui/select`, pre-existing, pattern from `admin-devices-client.tsx`).
- Produces: `UserManagementClient({ isAdmin, organizations }: { isAdmin: boolean; organizations: OrganizationWithDevices[] })`.

This is a UI-only change with no unit test (no existing client-component tests in this codebase for this area); verified via Task 8's e2e test and manual run (Step 3 below).

- [ ] **Step 1: Implement**

Replace the full contents of `app/(dashboard)/user-management/user-management-client.tsx`:

```tsx
'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { inviteMemberAction } from '@/domains/merchant/server/member-actions';
import type { MemberWithUser, OrganizationWithDevices } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';

export function UserManagementClient({
  isAdmin,
  organizations,
}: {
  isAdmin: boolean;
  organizations: OrganizationWithDevices[];
}) {
  const router = useRouter();
  const { data: members } = useSuspenseQuery(memberQueries.list());
  const [email, setEmail] = useState('');
  const [viewOrgId, setViewOrgId] = useState('');
  const [inviteOrgId, setInviteOrgId] = useState('');

  const invite = useAction(
    (args: { email: string; role: 'owner' | 'member'; organizationId?: string }) =>
      inviteMemberAction(args),
    {
      successMsg: 'Invitation sent',
      keys: [memberKeys.list()],
      onSuccess: () => setEmail(''),
    },
  );

  const visibleMembers = useMemo(
    () => (isAdmin && viewOrgId ? members.filter((m) => m.organizationId === viewOrgId) : members),
    [members, isAdmin, viewOrgId],
  );

  const columns: ColumnDef<MemberWithUser>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    ...(isAdmin
      ? ([
          {
            accessorKey: 'organizationName',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Organization" />,
          },
        ] as ColumnDef<MemberWithUser>[])
      : []),
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'owner' ? 'default' : 'secondary'}>
          {row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'deviceCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Devices" className="justify-end" />
      ),
      cell: ({ row }) => <div className="text-right">{row.original.deviceCount}</div>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.role === 'member' ? (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/user-management/${row.original.id}`)}
            >
              Assign devices
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={visibleMembers}
      showRowSelected={false}
      headerContent={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">User management</h1>
            {isAdmin && (
              <div className="w-56">
                <Label htmlFor="view-org">Filter by organization</Label>
                <Select
                  value={viewOrgId || 'all'}
                  onValueChange={(value: string | null) =>
                    setViewOrgId(value && value !== 'all' ? value : '')
                  }
                >
                  <SelectTrigger id="view-org" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organizations</SelectItem>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({
                email,
                role: 'member',
                organizationId: isAdmin ? inviteOrgId : undefined,
              });
            }}
          >
            <div>
              <Label htmlFor="invite-email">Invite a sub-merchant by email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="sub-merchant@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            {isAdmin && (
              <div className="w-56">
                <Label htmlFor="invite-org">Into organization</Label>
                <Select
                  value={inviteOrgId}
                  onValueChange={(value: string | null) => setInviteOrgId(value ?? '')}
                >
                  <SelectTrigger id="invite-org" className="mt-1">
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" disabled={invite.isPending || (isAdmin && !inviteOrgId)}>
              {invite.isPending ? 'Sending…' : 'Invite'}
            </Button>
          </form>
        </div>
      }
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, log in as `admin@e2e.local` / `E2e-admin-123` (seed with `npm run db:seed:e2e` first if the e2e DB isn't already seeded), open `/user-management`. Confirm: no redirect, member table shows members from every org with an "Organization" column, the filter select narrows the table, and the invite button is disabled until an organization is picked. Then log in as `merchant@e2e.local` / `E2e-merchant-123` and confirm the page looks exactly as it did before (no org column, no filter, invite works with just an email).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/user-management/user-management-client.tsx"
git commit -m "feat: add org filter and org-targeted invite to admin user-management view"
```

---

### Task 7: Detail page UI — thread organizationId through assign/unassign

**Files:**
- Modify: `app/(dashboard)/user-management/[memberId]/member-detail-client.tsx`

**Interfaces:**
- Consumes: `assignDeviceAction(deviceId, memberId, organizationId?)`, `unassignDeviceAction(deviceId, organizationId?)` (Task 2).

- [ ] **Step 1: Implement**

In `app/(dashboard)/user-management/[memberId]/member-detail-client.tsx`, replace the component signature and the two `useAction` calls:

```tsx
export function MemberDetailClient({
  member,
  organizationId,
}: {
  member: MemberWithUser;
  organizationId: string;
}) {
  const { data: devices } = useSuspenseQuery(deviceQueries.list());

  const assign = useAction(
    (args: { deviceId: string; memberId: string }) =>
      assignDeviceAction(args.deviceId, args.memberId, organizationId),
    {
      successMsg: 'Device assigned',
      keys: [deviceKeys.lists()],
    },
  );
  const unassign = useAction(
    (deviceId: string) => unassignDeviceAction(deviceId, organizationId),
    {
      successMsg: 'Device unassigned',
      keys: [deviceKeys.lists()],
    },
  );
```

(Everything below — `assigned`, `pool`, the two column defs, the JSX — is unchanged.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

As `admin@e2e.local`, from `/user-management` filtered to "E2E Shop", open "E2E Sub"'s detail page, assign and then unassign a device. Confirm no error toast and the device moves between "Assigned devices" and "Assign a device" sections. Repeat as `merchant@e2e.local` to confirm the owner path still works.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/user-management/[memberId]/member-detail-client.tsx"
git commit -m "feat: pass organizationId through member device assign/unassign actions"
```

---

### Task 8: E2E coverage for the admin flow

**Files:**
- Modify: `tests/e2e/owner-dashboard.spec.ts` (add an admin describe block; the existing owner tests already assert owner behavior is unchanged)

**Interfaces:**
- Consumes: seeded fixtures from `db/seed/e2e.ts` — `admin@e2e.local` / `E2e-admin-123`, organization "E2E Shop" (owner "E2E Merchant" / `merchant@e2e.local`, member "E2E Sub" / `sub@e2e.local`).

- [ ] **Step 1: Write the e2e test**

Append to `tests/e2e/owner-dashboard.spec.ts`:

```ts
test.describe('admin user management', () => {
  test('admin reaches /user-management without being redirected and sees members from every org', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.local');
    await page.getByLabel('Password').fill('E2e-admin-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');

    await page.getByRole('link', { name: 'User management' }).first().click();
    await expect(page).toHaveURL(/\/user-management$/);
    await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
    await expect(page.getByText('E2E Merchant')).toBeVisible();
    await expect(page.getByText('E2E Sub')).toBeVisible();
    await expect(page.getByText('E2E Shop')).toBeVisible();
  });

  test('admin can filter members by organization', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.local');
    await page.getByLabel('Password').fill('E2e-admin-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');
    await page.goto('/user-management');

    await page.getByLabel('Filter by organization').click();
    await page.getByRole('option', { name: 'E2E Shop' }).click();
    await expect(page.getByText('E2E Sub')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test tests/e2e/owner-dashboard.spec.ts`
Expected: all tests in the file PASS, including the pre-existing owner tests (confirms the owner path is unaffected) and the two new admin tests.

- [ ] **Step 3: Run the full e2e suite**

Run: `npx playwright test`
Expected: PASS — in particular `tests/e2e/sub-merchant-access.spec.ts` unaffected.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/owner-dashboard.spec.ts
git commit -m "test: cover admin access to /user-management end-to-end"
```

---

## Final verification

- [ ] Run `npx vitest run --coverage` — all unit tests pass, `domains/**`/`lib/**` thresholds met.
- [ ] Run `npx tsc --noEmit` — no type errors.
- [ ] Run `npx playwright test` — full e2e suite passes.
- [ ] Manually confirm the original bug report is fixed: log in as an `ADMIN` user and click "User management" in the sidebar — it no longer redirects to `/`.
