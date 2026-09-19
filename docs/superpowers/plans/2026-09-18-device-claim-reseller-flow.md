# Device Claim & Reseller Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a device's claim code is validated, correctly route the caller (anonymous, sub-merchant, or org owner) through destination setup, direct org binding, or the claim-vs-resell decision — plus the public multi-link landing page and the dashboard nav/route pruning that goes with it.

**Architecture:** One new branching function (`resolvePostClaim`) decides where a just-validated claim goes; it's called both synchronously (session already exists) and after a deferred login/register carrying a signed device token. A new `/s/[slug]/option` page hosts the owner's claim-vs-resell choice. The public landing page gains a star row (linking to the existing Google review URL) and icon-based destination buttons. Dashboard pruning is mostly permission-table + route-deletion, since the row-actions dropdown pattern (`createActionsColumn`) already exists.

**Tech Stack:** Next.js (App Router, Server Actions), Drizzle ORM (MySQL), better-auth (organization plugin), Zod, Vitest + Testing Library, Playwright, react-icons (new dependency).

**Spec:** `docs/superpowers/specs/2026-09-18-device-claim-reseller-flow-design.md`

## Global Constraints

- Claim codes are 8 uppercase alphanumeric chars (`generateClaimCode`, `CLAIM_CODE_PATTERN`) — already implemented, unchanged.
- `device.status` reuses `UNCLAIMED` for "reseller chose to resell" — no new enum value.
- The `?d=` query param is always the signed setup token (`base64url({deviceId}.{issuedAtMs}).{hmac}`), never a raw device id. Same 10-minute TTL as the existing setup token.
- No schema changes (verified against `db/schema/index.ts`).
- Every star on the public links page navigates to the same `deriveReviewUrl(placeId)` — Google has no rating-prefill param.
- `businessName` and `phone` are required on `/register` going forward (`merchantProfile.phone` column already exists).

---

## Task 1: `resolveSetupToken` — decode without a known device id

**Files:**
- Modify: `lib/setup-token.ts`
- Test: `tests/unit/lib/setup-token.test.ts`

**Interfaces:**
- Produces: `resolveSetupToken(token: string, now?: number, key?: string): string | null` — returns the device id if the token is well-formed, unexpired, and its HMAC verifies; otherwise `null`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/lib/setup-token.test.ts` (alongside the existing `issueSetupToken`/`verifySetupToken` tests):

```ts
import { issueSetupToken, resolveSetupToken } from '@/lib/setup-token';

describe('resolveSetupToken', () => {
  const KEY = 'test-secret';
  const NOW = 1_700_000_000_000;

  it('returns the device id for a valid token', () => {
    const token = issueSetupToken('device-1', NOW, KEY);
    expect(resolveSetupToken(token, NOW + 1000, KEY)).toBe('device-1');
  });

  it('returns null once the token expires', () => {
    const token = issueSetupToken('device-1', NOW, KEY);
    expect(resolveSetupToken(token, NOW + 11 * 60 * 1000, KEY)).toBeNull();
  });

  it('returns null when the signature is tampered', () => {
    const token = issueSetupToken('device-1', NOW, KEY);
    const [payload] = token.split('.');
    expect(resolveSetupToken(`${payload}.deadbeef`, NOW + 1000, KEY)).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(resolveSetupToken('not-a-token', NOW, KEY)).toBeNull();
    expect(resolveSetupToken('', NOW, KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/lib/setup-token.test.ts`
Expected: FAIL — `resolveSetupToken is not a function` (or a TS import error).

- [ ] **Step 3: Implement `resolveSetupToken`**

Add to `lib/setup-token.ts`, after `verifySetupToken`:

```ts
/**
 * Decodes + verifies a setup token without requiring the caller to already
 * know the device id (unlike verifySetupToken, which checks against one).
 * Used by the login/register `?d=` handoff, which only has the token.
 */
export function resolveSetupToken(
  token: string,
  now: number = Date.now(),
  key: string = secret(),
): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const [id, issuedAtRaw] = payload.split('.');
    if (!id) return null;
    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) return null;
    if (now - issuedAt > TTL_MS || issuedAt > now + MAX_CLOCK_SKEW_MS) return null;
    const expected = sign(payload, key);
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return id;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/lib/setup-token.test.ts`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add lib/setup-token.ts tests/unit/lib/setup-token.test.ts
git commit -m "feat: add resolveSetupToken for the login/register device handoff"
```

---

## Task 2: `resolvePostClaim` — the owner/reseller branch

**Files:**
- Modify: `domains/merchant/server/service.ts`
- Test: `tests/unit/merchant/resolve-post-claim.test.ts` (new)

**Interfaces:**
- Consumes: `getDb()`, `device`/`member` tables (`@/db/schema`), `getActiveOrganization`/`isOwner` (`@/domains/merchant/server/permissions`), `AppError` (`@/lib/errors`).
- Produces: `resolvePostClaim(deviceId: string, userId: string): Promise<{ redirectUrl: string }>`.

Branch table (from the spec):

| Device has org? | Caller role | Outcome |
|---|---|---|
| Yes | any | Bind caller into that org → `/dashboard` |
| No | owner | → `/s/{slug}/option` |
| No | member | Bind caller into their own org → `/dashboard` |

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/merchant/resolve-post-claim.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = {
  query: { device: { findFirst: vi.fn() } },
  update: vi.fn(),
};
vi.mock('@/db', () => ({ getDb: () => dbMock }));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
  isOwner: (m: { role: string }) => m.role === 'owner',
}));

import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { resolvePostClaim } from '@/domains/merchant/server/service';

function mockUpdate() {
  const set = vi.fn().mockReturnThis();
  const where = vi.fn().mockResolvedValue(undefined);
  dbMock.update.mockReturnValue({ set: set.mockReturnValue({ where }) });
  return { set, where };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolvePostClaim', () => {
  it('binds the caller into the device org when one already exists', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      slug: 'dev-1-slug',
      organizationId: 'org-existing',
    });
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-caller',
      role: 'member',
    });
    mockUpdate();

    const result = await resolvePostClaim('dev-1', 'user-1');
    expect(result).toEqual({ redirectUrl: '/dashboard' });
    expect(dbMock.update).toHaveBeenCalled();
  });

  it('sends an owner with no device org to /option', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-2',
      slug: 'dev-2-slug',
      organizationId: null,
    });
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-2',
      organizationId: 'org-caller',
      role: 'owner',
    });

    const result = await resolvePostClaim('dev-2', 'user-2');
    expect(result).toEqual({ redirectUrl: '/s/dev-2-slug/option' });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('binds a member into their own org when the device has none', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-3',
      slug: 'dev-3-slug',
      organizationId: null,
    });
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-3',
      organizationId: 'org-caller',
      role: 'member',
    });
    mockUpdate();

    const result = await resolvePostClaim('dev-3', 'user-3');
    expect(result).toEqual({ redirectUrl: '/dashboard' });
  });

  it('throws when the caller has no membership at all', async () => {
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-4',
      slug: 'dev-4-slug',
      organizationId: null,
    });
    vi.mocked(getActiveOrganization).mockResolvedValue(null);

    await expect(resolvePostClaim('dev-4', 'user-4')).rejects.toThrow();
  });

  it('throws when the device does not exist', async () => {
    dbMock.query.device.findFirst.mockResolvedValue(undefined);
    await expect(resolvePostClaim('missing', 'user-5')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/merchant/resolve-post-claim.test.ts`
Expected: FAIL — `resolvePostClaim is not a function`.

- [ ] **Step 3: Implement `resolvePostClaim`**

Add to `domains/merchant/server/service.ts`, in the "Claim-code account flows" section (near `claimWithCode`):

```ts
/**
 * Runs immediately after a claim code validates (device status CLAIMED,
 * no account bound yet). Decides where the caller goes next: bind
 * directly into an org if one is already attached to the device or the
 * caller is a non-owner member, or send an owner to the resell/claim
 * decision when the device has no org yet.
 */
export async function resolvePostClaim(
  deviceId: string,
  userId: string,
): Promise<{ redirectUrl: string }> {
  const db = getDb();
  const row = await db.query.device.findFirst({ where: eq(device.id, deviceId) });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');

  const membership = await getActiveOrganization(userId);
  if (!membership) {
    throw new AppError(409, 'NO_ORGANIZATION', 'You are not part of an organization yet');
  }

  if (row.organizationId || !isOwner(membership)) {
    const organizationId = row.organizationId ?? membership.organizationId;
    await db
      .update(device)
      .set({
        organizationId,
        memberId: membership.id,
        boundUserId: userId,
        status: 'CLAIMED',
        updatedAt: new Date(),
      })
      .where(eq(device.id, deviceId));
    return { redirectUrl: '/dashboard' };
  }

  return { redirectUrl: `/s/${row.slug}/option` };
}
```

Add `isOwner` to the existing `import { getActiveOrganization, ... } from ...` — check the top of `domains/merchant/server/service.ts`: it currently imports `type { Membership }` from `@/domains/merchant/server/permissions` but not `getActiveOrganization`/`isOwner` as values. Add:

```ts
import { getActiveOrganization, isOwner, type Membership } from '@/domains/merchant/server/permissions';
```

(replacing the existing `import type { Membership } from ...` line.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/merchant/resolve-post-claim.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add domains/merchant/server/service.ts tests/unit/merchant/resolve-post-claim.test.ts
git commit -m "feat: add resolvePostClaim to branch owners into /option vs. direct claim"
```

---

## Task 3: `ownerForgetDevice` — org-scoped resell/forget reset

**Files:**
- Modify: `domains/device/server/service.ts`
- Test: `tests/unit/device/owner-forget-device.test.ts` (new)

**Interfaces:**
- Consumes: existing private `clearDeviceConfig(id, now)` (already defined in this file), `hashClaimCode`/`generateClaimCode` (`@/lib/codes`), `AppError`.
- Produces: `ownerForgetDevice(id: string, organizationId: string): Promise<{ device: DeviceSummary; claimCode: string }>` — asserts the device belongs to `organizationId` first (unlike `adminReset`, which trusts the platform admin), then clears destinations, nulls `memberId`/`boundUserId`/`organizationId`, sets status `UNCLAIMED`, rotates the claim code hash.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/device/owner-forget-device.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = {
  query: { device: { findFirst: vi.fn() } },
  delete: vi.fn(),
  update: vi.fn(),
};
vi.mock('@/db', () => ({ getDb: () => dbMock }));

import { ownerForgetDevice } from '@/domains/device/server/service';

function chainable() {
  const where = vi.fn().mockResolvedValue(undefined);
  return { where, set: vi.fn().mockReturnValue({ where }), from: vi.fn().mockReturnValue({ where }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.delete.mockReturnValue(chainable());
  dbMock.update.mockReturnValue(chainable());
});

describe('ownerForgetDevice', () => {
  it('clears config and detaches the org for a device the org owns', async () => {
    dbMock.query.device.findFirst
      .mockResolvedValueOnce({ id: 'dev-1', organizationId: 'org-1' }) // ownership check
      .mockResolvedValueOnce({
        id: 'dev-1',
        slug: 'dev-1-slug',
        name: 'Device 1',
        status: 'UNCLAIMED',
        createdAt: new Date(),
        organizationId: null,
      }); // re-read after update

    const result = await ownerForgetDevice('dev-1', 'org-1');
    expect(result.device.status).toBe('UNCLAIMED');
    expect(result.claimCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it('rejects a device that belongs to a different org', async () => {
    dbMock.query.device.findFirst.mockResolvedValue(undefined);
    await expect(ownerForgetDevice('dev-2', 'org-1')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/device/owner-forget-device.test.ts`
Expected: FAIL — `ownerForgetDevice is not a function`.

- [ ] **Step 3: Implement `ownerForgetDevice`**

Add to `domains/device/server/service.ts`, right after `adminReset` (reuses the same `clearDeviceConfig` helper already defined above it in the file):

```ts
/**
 * Owner-triggered equivalent of adminReset: same clear-and-detach behavior,
 * but scoped to devices the caller's organization actually owns (unlike
 * adminReset, which trusts the platform admin caller). Used by the
 * dashboard's "Forgot device" action and /option's "Resell" choice.
 */
export async function ownerForgetDevice(
  id: string,
  organizationId: string,
): Promise<{ device: DeviceSummary; claimCode: string }> {
  const db = getDb();
  const owned = await db.query.device.findFirst({
    where: and(eq(device.id, id), eq(device.organizationId, organizationId)),
  });
  if (!owned) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found in this organization');

  const now = new Date();
  const claimCode = generateClaimCode();
  await clearDeviceConfig(id, now);
  await db
    .update(device)
    .set({
      status: 'UNCLAIMED',
      organizationId: null,
      claimCodeHash: hashClaimCode(claimCode),
      updatedAt: now,
    })
    .where(eq(device.id, id));
  return { device: toSummmary(await readDeviceOrFail(id)), claimCode };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/device/owner-forget-device.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add domains/device/server/service.ts tests/unit/device/owner-forget-device.test.ts
git commit -m "feat: add ownerForgetDevice for org-scoped resell/forget"
```

---

## Task 4: Wire `resolvePostClaim` into `setupClaimCodeAction`

**Files:**
- Modify: `domains/device/server/setup-actions.ts`
- Modify: `tests/unit/device/setup-actions.test.ts`

**Interfaces:**
- Consumes: `resolvePostClaim` (Task 2), `getSession` (`@/lib/session`).
- Produces: `setupClaimCodeAction` now returns a session-owner's `resolvePostClaim` redirect instead of always going to the destination editor.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/device/setup-actions.test.ts` (extends the existing mocked-service pattern in that file):

```ts
vi.mock('@/domains/merchant/server/service', () => ({
  resolvePostClaim: vi.fn(),
}));
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

import { resolvePostClaim } from '@/domains/merchant/server/service';
import { getSession } from '@/lib/session';

// ...inside describe('setupClaimCodeAction (US1 step 1)', ...):

it('uses resolvePostClaim redirect when a session exists', async () => {
  vi.mocked(claimAccountless).mockResolvedValue({
    id: 'dev-1',
    slug: 'slug-one',
    name: 'Device',
  } as never);
  vi.mocked(getSession).mockResolvedValue({
    id: 'user-1',
    role: 'MERCHANT',
    email: 'a@b.com',
    name: 'A',
  } as never);
  vi.mocked(resolvePostClaim).mockResolvedValue({ redirectUrl: '/s/slug-one/option' });

  const result = await setupClaimCodeAction('slug-one', { claimCode: 'ABCD1234' });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.data.redirectUrl).toBe('/s/slug-one/option');
  expect(issueSetupToken).not.toHaveBeenCalled();
});
```

Also add `issueSetupToken` to the existing `vi.mock('@/lib/setup-token', ...)` in that file if not already exposed as a spy (it currently mocks only `issueSetupToken: vi.fn(() => 'tok-123')` — keep that, just assert on the existing mock).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/device/setup-actions.test.ts`
Expected: FAIL — the accountless redirect is always returned; `resolvePostClaim` is never called.

- [ ] **Step 3: Implement the branch in `setupClaimCodeAction`**

Replace the body of `domains/device/server/setup-actions.ts`:

```ts
'use server';

import { setupClaimCodeSchema } from '@/domains/device/schemas';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { getSession } from '@/lib/session';
import { issueSetupToken } from '@/lib/setup-token';
import { resolvePostClaim } from '@/domains/merchant/server/service';
import { claimAccountless } from './service';

/**
 * Public (no auth) step 1 of accountless setup (FR-004).
 * Validates the claim code for a slug, marks the device CLAIMED. With no
 * session, returns a short-lived setup token so step 2
 * (/s/{slug}/setup/redirect) can save destinations without an account. With
 * a session already present, skips straight to resolvePostClaim's branch
 * (direct org bind, or the owner's /option decision).
 */
export async function setupClaimCodeAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const parsed = setupClaimCodeSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid claim code');
    }
    const device = await claimAccountless(slug, parsed.data.claimCode);

    const session = await getSession();
    if (session) {
      return ok(await resolvePostClaim(device.id, session.id));
    }

    const token = issueSetupToken(device.id);
    return ok({ redirectUrl: `/s/${device.slug}/setup/redirect?t=${token}` });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Setup failed');
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/device/setup-actions.test.ts`
Expected: PASS (all tests, including the pre-existing accountless-path ones — `getSession` must be mocked to resolve `null` by default in those, so add `vi.mocked(getSession).mockResolvedValue(null)` in the file's `beforeEach`).

- [ ] **Step 5: Commit**

```bash
git add domains/device/server/setup-actions.ts tests/unit/device/setup-actions.test.ts
git commit -m "feat: branch setupClaimCodeAction through resolvePostClaim when a session exists"
```

---

## Task 5: Register form — required business name + phone, org auto-creation

**Files:**
- Modify: `domains/auth/schemas.ts`
- Modify: `domains/merchant/server/service.ts` (export `slugifyName`, add `createOrganizationForUser`)
- Modify: `domains/auth/server/actions.ts`
- Test: `tests/unit/auth/actions.test.ts` (extend existing, or create if none exists)

**Interfaces:**
- Produces: `signUpSchema` requires `businessName` and `phone`; `createOrganizationForUser(userId: string, businessName: string): Promise<{ organizationId: string }>` (new, in `domains/merchant/server/service.ts`).

- [ ] **Step 1: Check for an existing auth actions test file**

Run: `ls tests/unit/auth/ 2>/dev/null || find tests/unit -iname "*auth*action*"`

If a file covering `signUpAction` already exists, extend it with the steps below; otherwise create `tests/unit/auth/actions.test.ts` following the mocking pattern used in `tests/unit/device/setup-actions.test.ts` (mock `@/lib/auth`, `@/db`, and `@/domains/merchant/server/service`).

- [ ] **Step 2: Write the failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = { insert: vi.fn(), update: vi.fn() };
vi.mock('@/db', () => ({ getDb: () => dbMock }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { signUpEmail: vi.fn() } },
}));
vi.mock('@/domains/merchant/server/service', () => ({
  createOrganizationForUser: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { auth } from '@/lib/auth';
import { createOrganizationForUser } from '@/domains/merchant/server/service';
import { signUpAction } from '@/domains/auth/server/actions';

function chainable() {
  const where = vi.fn().mockResolvedValue(undefined);
  return { where, set: vi.fn().mockReturnValue({ where }), values: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.update.mockReturnValue(chainable());
  dbMock.insert.mockReturnValue(chainable());
});

describe('signUpAction', () => {
  it('rejects registration missing businessName or phone', async () => {
    const result = await signUpAction({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      businessName: '',
      phone: '',
    } as never);
    expect(result.ok).toBe(false);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  it('creates the account, profile, and an organization the user owns', async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { id: 'user-1' },
    } as never);
    vi.mocked(createOrganizationForUser).mockResolvedValue({ organizationId: 'org-1' });

    const result = await signUpAction({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      businessName: 'Ada Co',
      phone: '+15551234567',
    });

    expect(result.ok).toBe(true);
    expect(createOrganizationForUser).toHaveBeenCalledWith('user-1', 'Ada Co');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/auth/actions.test.ts`
Expected: FAIL — `phone` isn't in the schema yet, `createOrganizationForUser` is never called.

- [ ] **Step 4: Update `signUpSchema`**

Replace in `domains/auth/schemas.ts`:

```ts
export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  businessName: z.string().trim().min(1, 'Business name is required').max(120),
  phone: z.string().trim().min(1, 'Phone number is required').max(30),
});
```

- [ ] **Step 5: Add `createOrganizationForUser` and export `slugifyName`**

In `domains/merchant/server/service.ts`, change `function slugifyName` to `export function slugifyName` (no other changes to its body), then add this new function directly below `createOrganizationShell`:

```ts
/**
 * Registration-time org creation: the new user becomes the org's owner via
 * better-auth's organization plugin (unlike createOrganizationShell, which
 * makes an ownerless shell for admin-assigned merchants).
 */
export async function createOrganizationForUser(
  userId: string,
  businessName: string,
): Promise<{ organizationId: string }> {
  const db = getDb();
  const trimmed = businessName.trim();
  let slug = slugifyName(trimmed);
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
    if (!existing) break;
    slug = `${slugifyName(trimmed)}-${randomSlug(4)}`;
  }
  const created = await auth.api.createOrganization({
    body: { name: trimmed, slug, userId },
  });
  if (!created) throw new AppError(500, 'ORG_CREATE_FAILED', 'Could not create the organization');
  return { organizationId: created.id };
}
```

- [ ] **Step 6: Update `signUpAction`**

Replace the body of `signUpAction` in `domains/auth/server/actions.ts`:

```ts
/** Server Action registration: creates the user, promotes to MERCHANT, adds
 * profile, and creates an organization the user owns. */
export async function signUpAction(input: SignUpInput): Promise<ActionResult<AuthResult>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid registration details';
    return fail(message);
  }

  try {
    const { user: created } = await auth.api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
    });
    if (!created) {
      return fail('Registration failed');
    }

    const db = getDb();
    const now = new Date();
    await db
      .update(user)
      .set({ role: 'MERCHANT', emailVerified: true })
      .where(eq(user.id, created.id));

    await db.insert(merchantProfile).values({
      userId: created.id,
      businessName: parsed.data.businessName,
      phone: parsed.data.phone,
      country: null,
      createdAt: now,
      updatedAt: now,
    });

    await createOrganizationForUser(created.id, parsed.data.businessName);

    revalidatePath('/', 'layout');
    return ok({ role: 'MERCHANT' });
  } catch (err) {
    logger.error({ err }, 'registration failed');
    return fail(err instanceof Error ? err.message : 'Registration failed');
  }
}
```

Add `import { createOrganizationForUser } from '@/domains/merchant/server/service';` to the top of the file.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/auth/actions.test.ts`
Expected: PASS (both tests).

- [ ] **Step 8: Update the register form for the new required field + UI**

In `app/(auth)/register/register-form.tsx`: add a `phone` field (same `form.Field` pattern as `businessName`), remove the "(optional)" wording from the `businessName` label since it's now required, and add `required` to both inputs. Change the `useForm` `defaultValues` to include `phone: ''`, and the `signUp.mutate` call to pass `phone: value.phone`.

- [ ] **Step 9: Run the full unit suite**

Run: `npx vitest run`
Expected: all pass. (This also confirms nothing depending on the old optional-`businessName` shape broke — check `tests/unit` for any other `signUpAction`/`signUpSchema` references and update them the same way if found.)

- [ ] **Step 10: Commit**

```bash
git add domains/auth/schemas.ts domains/auth/server/actions.ts domains/merchant/server/service.ts app/\(auth\)/register/register-form.tsx tests/unit/auth/actions.test.ts
git commit -m "feat: require business name + phone on register, auto-create the owner's org"
```

---

## Task 6: Carry `?d=` through register/login, link the device post-auth

**Files:**
- Create: `domains/device/server/link-actions.ts`
- Modify: `app/(auth)/register/register-form.tsx`
- Modify: `app/(auth)/login/login-form.tsx`
- Test: `tests/unit/device/link-actions.test.ts` (new)

**Interfaces:**
- Consumes: `resolveSetupToken` (Task 1), `resolvePostClaim` (Task 2), `getSession` (`@/lib/session`).
- Produces: `linkDeviceAfterAuthAction(token: string): Promise<ActionResult<{ redirectUrl: string }>>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/device/link-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/setup-token', () => ({ resolveSetupToken: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/domains/merchant/server/service', () => ({ resolvePostClaim: vi.fn() }));

import { linkDeviceAfterAuthAction } from '@/domains/device/server/link-actions';
import { resolvePostClaim } from '@/domains/merchant/server/service';
import { getSession } from '@/lib/session';
import { resolveSetupToken } from '@/lib/setup-token';

beforeEach(() => vi.clearAllMocks());

describe('linkDeviceAfterAuthAction', () => {
  it('fails when there is no session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const result = await linkDeviceAfterAuthAction('tok');
    expect(result.ok).toBe(false);
  });

  it('fails silently-recoverable when the token is invalid or expired', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(resolveSetupToken).mockReturnValue(null);
    const result = await linkDeviceAfterAuthAction('bad-token');
    expect(result.ok).toBe(false);
    expect(resolvePostClaim).not.toHaveBeenCalled();
  });

  it('resolves the device id from the token and delegates to resolvePostClaim', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(resolveSetupToken).mockReturnValue('dev-1');
    vi.mocked(resolvePostClaim).mockResolvedValue({ redirectUrl: '/dashboard' });

    const result = await linkDeviceAfterAuthAction('good-token');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectUrl).toBe('/dashboard');
    expect(resolvePostClaim).toHaveBeenCalledWith('dev-1', 'user-1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/device/link-actions.test.ts`
Expected: FAIL — module `@/domains/device/server/link-actions` doesn't exist.

- [ ] **Step 3: Implement `linkDeviceAfterAuthAction`**

Create `domains/device/server/link-actions.ts`:

```ts
'use server';

import { resolvePostClaim } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { getSession } from '@/lib/session';
import { resolveSetupToken } from '@/lib/setup-token';

/**
 * Called client-side right after a successful login/register that carried
 * a `?d=` device token (the onboarding handoff, or a session-first /option
 * round trip through /login). Resolves the token to a device id and runs
 * the same post-claim branch as setupClaimCodeAction.
 */
export async function linkDeviceAfterAuthAction(
  token: string,
): Promise<ActionResult<{ redirectUrl: string }>> {
  const session = await getSession();
  if (!session) return fail('Not signed in');

  const deviceId = resolveSetupToken(token);
  if (!deviceId) return fail('This device link has expired — please scan the device again');

  try {
    return ok(await resolvePostClaim(deviceId, session.id));
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not link this device');
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/device/link-actions.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Wire the `d` param into the login and register forms**

In `app/(auth)/login/login-form.tsx`, add:

```ts
import { useSearchParams } from 'next/navigation';
import { linkDeviceAfterAuthAction } from '@/domains/device/server/link-actions';
```

Change the `login` action's `onSuccess`:

```ts
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceToken = searchParams.get('d');
  const login = useAction(signInAction, {
    successMsg: 'Signed in',
    onSuccess: async () => {
      if (deviceToken) {
        const linked = await linkDeviceAfterAuthAction(deviceToken);
        if (linked.ok) {
          router.push(linked.data.redirectUrl);
          return;
        }
      }
      router.push('/dashboard');
    },
  });
  // ...rest unchanged
```

Apply the identical pattern to `app/(auth)/register/register-form.tsx`'s `signUp` action (same `useSearchParams`/`deviceToken`/`onSuccess` shape, replacing its existing `onSuccess: () => router.push('/dashboard')`).

- [ ] **Step 6: Run the full unit suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add domains/device/server/link-actions.ts tests/unit/device/link-actions.test.ts app/\(auth\)/login/login-form.tsx app/\(auth\)/register/register-form.tsx
git commit -m "feat: carry the ?d= device token through login/register and link post-auth"
```

---

## Task 7: `/s/[slug]/option` page — claim for yourself vs. resell

**Files:**
- Create: `app/(redirect)/s/[slug]/option/page.tsx`
- Create: `app/(redirect)/s/[slug]/option/option-client.tsx`
- Create: `domains/device/server/option-actions.ts`
- Test: `tests/unit/device/option-actions.test.ts` (new)
- Test: `tests/unit/components/option-client.test.tsx` (new)

**Interfaces:**
- Consumes: `getSession`/`requireRole`-style guard (custom, since the redirect target needs `?d=`), `ownerForgetDevice` (Task 3), `getActiveOrganization`/`isOwner` (`@/domains/merchant/server/permissions`), `issueSetupToken` (`@/lib/setup-token`).
- Produces: `claimForSelfAction(deviceId: string): Promise<ActionResult<{ redirectUrl: string }>>`, `resellDeviceAction(deviceId: string): Promise<ActionResult<{ claimCode: string }>>`.

- [ ] **Step 1: Write the failing action tests**

Create `tests/unit/device/option-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = { query: { device: { findFirst: vi.fn() } }, update: vi.fn() };
vi.mock('@/db', () => ({ getDb: () => dbMock }));
vi.mock('@/lib/session', () => ({ requireRole: vi.fn() }));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
  isOwner: (m: { role: string }) => m.role === 'owner',
}));
vi.mock('@/domains/device/server/service', () => ({ ownerForgetDevice: vi.fn() }));

import { claimForSelfAction, resellDeviceAction } from '@/domains/device/server/option-actions';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { ownerForgetDevice } from '@/domains/device/server/service';
import { requireRole } from '@/lib/session';

function chainable() {
  const where = vi.fn().mockResolvedValue(undefined);
  return { where, set: vi.fn().mockReturnValue({ where }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.update.mockReturnValue(chainable());
});

describe('claimForSelfAction', () => {
  it('rejects a caller who is not an org owner', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'member',
    });
    const result = await claimForSelfAction('dev-1');
    expect(result.ok).toBe(false);
  });

  it('binds the device to the owner org', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    const result = await claimForSelfAction('dev-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectUrl).toBe('/dashboard');
    expect(dbMock.update).toHaveBeenCalled();
  });
});

describe('resellDeviceAction', () => {
  it('rejects a non-owner', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'member',
    });
    const result = await resellDeviceAction('dev-1');
    expect(result.ok).toBe(false);
    expect(ownerForgetDevice).not.toHaveBeenCalled();
  });

  it('resets the device and returns the new claim code', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    vi.mocked(ownerForgetDevice).mockResolvedValue({
      device: { id: 'dev-1', slug: 's', name: 'D', status: 'UNCLAIMED', createdAt: '' },
      claimCode: 'ABCD1234',
    });
    const result = await resellDeviceAction('dev-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.claimCode).toBe('ABCD1234');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/device/option-actions.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the actions**

Create `domains/device/server/option-actions.ts`:

```ts
'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { device } from '@/db/schema';
import { ownerForgetDevice } from '@/domains/device/server/service';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireRole } from '@/lib/session';

async function requireOwnerMembership() {
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    throw new Error('Only an organization owner can make this choice');
  }
  return membership;
}

/** /option: claim an org-less device into the caller's own organization. */
export async function claimForSelfAction(
  deviceId: string,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const membership = await requireOwnerMembership();
    const db = getDb();
    await db
      .update(device)
      .set({
        organizationId: membership.organizationId,
        memberId: membership.id,
        status: 'CLAIMED',
        updatedAt: new Date(),
      })
      .where(eq(device.id, deviceId));
    return ok({ redirectUrl: '/dashboard' });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not claim this device');
  }
}

/** /option: release the device back to UNCLAIMED, wiped, with a fresh code. */
export async function resellDeviceAction(
  deviceId: string,
): Promise<ActionResult<{ claimCode: string }>> {
  try {
    const membership = await requireOwnerMembership();
    const result = await ownerForgetDevice(deviceId, membership.organizationId);
    return ok({ claimCode: result.claimCode });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not reset this device');
  }
}
```

- [ ] **Step 4: Run the action tests to verify they pass**

Run: `npx vitest run tests/unit/device/option-actions.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Build the page (server component, custom session guard)**

Create `app/(redirect)/s/[slug]/option/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getBySlug } from '@/domains/device/server/service';
import { getSession } from '@/lib/session';
import { issueSetupToken } from '@/lib/setup-token';
import { OptionClient } from './option-client';

export const dynamic = 'force-dynamic';

export default async function DeviceOptionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const device = await getBySlug(slug);
  if (!device) notFound();

  const session = await getSession();
  if (!session) {
    redirect(`/login?d=${issueSetupToken(device.id)}`);
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{device.name}</h1>
        <p className="text-sm text-muted-foreground">
          This device isn't linked to a merchant yet. What would you like to do?
        </p>
      </div>
      <OptionClient deviceId={device.id} />
    </div>
  );
}
```

Check `getBySlug`'s export in `domains/device/server/service.ts` — it's already used by `app/(redirect)/s/[slug]/setup/page.tsx`, so this import path is confirmed correct.

- [ ] **Step 6: Write the failing client test**

Create `tests/unit/components/option-client.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OptionClient } from '@/app/(redirect)/s/[slug]/option/option-client';
import { claimForSelfAction, resellDeviceAction } from '@/domains/device/server/option-actions';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
}));
vi.mock('@/domains/device/server/option-actions', () => ({
  claimForSelfAction: vi.fn(),
  resellDeviceAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockPush = vi.fn();
vi.mocked(useRouter).mockReturnValue({ replace: vi.fn(), push: mockPush } as never);

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OptionClient deviceId="dev-1" />
    </QueryClientProvider>,
  );
}

describe('OptionClient', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it('renders both choices', () => {
    renderClient();
    expect(screen.getByRole('button', { name: /claim for yourself/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resell/i })).toBeInTheDocument();
  });

  it('confirms then claims for self', async () => {
    vi.mocked(claimForSelfAction).mockResolvedValue({ ok: true, data: { redirectUrl: '/dashboard' } });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: /claim for yourself/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    await waitFor(() => {
      expect(claimForSelfAction).toHaveBeenCalledWith('dev-1');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('confirms then resells and shows the new claim code', async () => {
    vi.mocked(resellDeviceAction).mockResolvedValue({ ok: true, data: { claimCode: 'NEWCODE1' } });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: /^resell$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    await waitFor(() => {
      expect(resellDeviceAction).toHaveBeenCalledWith('dev-1');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});
```

- [ ] **Step 7: Run the client test to verify it fails**

Run: `npx vitest run tests/unit/components/option-client.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 8: Implement `OptionClient`**

Create `app/(redirect)/s/[slug]/option/option-client.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { claimForSelfAction, resellDeviceAction } from '@/domains/device/server/option-actions';

type Choice = 'claim' | 'resell' | null;

export function OptionClient({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Choice>(null);
  const [isPending, setIsPending] = useState(false);

  async function confirm() {
    setIsPending(true);
    if (pending === 'claim') {
      const result = await claimForSelfAction(deviceId);
      setIsPending(false);
      setPending(null);
      if (!result.ok) return toast.error(result.error);
      toast.success('Device claimed');
      router.push(result.data.redirectUrl);
      return;
    }
    if (pending === 'resell') {
      const result = await resellDeviceAction(deviceId);
      setIsPending(false);
      setPending(null);
      if (!result.ok) return toast.error(result.error);
      toast.success('Device reset for resale', { description: `New code: ${result.data.claimCode}` });
      router.push('/dashboard');
    }
  }

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claim for yourself</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Add this device to your own merchant and manage it from your dashboard.
          </p>
          <Button className="w-full" onClick={() => setPending('claim')}>
            Claim for yourself
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resell</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Keep this device unclaimed with a fresh code so you can sell it to a merchant.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setPending('resell')}>
            Resell
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === 'claim' ? 'Claim this device?' : 'Resell this device?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === 'claim'
                ? 'This device will be added to your merchant.'
                : 'Any existing links on this device will be cleared and a new claim code issued.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancel</AlertDialogCancel>
            <Button disabled={isPending} onClick={confirm}>
              {isPending ? '…' : 'Confirm'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 9: Run the client test to verify it passes**

Run: `npx vitest run tests/unit/components/option-client.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 10: Manually verify the page renders**

Run: `npm run dev`, then visit `/s/<a-seeded-unclaimed-device-slug>/option` while signed out — confirm it redirects to `/login?d=...` rather than erroring. (Full owner round trip is covered by the E2E task later in this plan.)

- [ ] **Step 11: Commit**

```bash
git add app/\(redirect\)/s/\[slug\]/option domains/device/server/option-actions.ts tests/unit/device/option-actions.test.ts tests/unit/components/option-client.test.tsx
git commit -m "feat: add /s/[slug]/option claim-vs-resell page"
```

---

## Task 8: Public links page — star row + icon linktree

**Files:**
- Create: `lib/destination-icon.tsx`
- Modify: `app/(redirect)/s/[slug]/landing-client.tsx`
- Modify: `package.json` (add `react-icons`)
- Test: `tests/unit/lib/destination-icon.test.tsx` (new)
- Test: extend `tests/unit/components/` landing test if one exists, else create `tests/unit/components/landing-client.test.tsx`

**Interfaces:**
- Produces: `destinationIcon(type: string): IconType` (from `react-icons`) in `lib/destination-icon.tsx`.

- [ ] **Step 1: Check for an existing landing-client test**

Run: `find tests/unit -iname "*landing*"`

If none exists, this task creates `tests/unit/components/landing-client.test.tsx`; if one exists, extend it with the steps below (keep its existing `outcome: 'INACTIVE'` coverage untouched).

- [ ] **Step 2: Install react-icons**

Run: `npm install react-icons`
Expected: `package.json`/`package-lock.json` gain the `react-icons` dependency.

- [ ] **Step 3: Write the failing icon-mapping test**

Create `tests/unit/lib/destination-icon.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { FaFacebook, FaGlobe, FaInstagram, FaLink, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import { destinationIcon } from '@/lib/destination-icon';

describe('destinationIcon', () => {
  it.each([
    ['INSTAGRAM', FaInstagram],
    ['FACEBOOK', FaFacebook],
    ['TIKTOK', FaTiktok],
    ['WHATSAPP', FaWhatsapp],
    ['WEBSITE', FaGlobe],
    ['CUSTOM_URL', FaLink],
    ['SOMETHING_UNKNOWN', FaLink],
  ])('maps %s to the right icon', (type, expected) => {
    expect(destinationIcon(type)).toBe(expected);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/unit/lib/destination-icon.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 5: Implement `destinationIcon`**

Create `lib/destination-icon.tsx`:

```tsx
import type { IconType } from 'react-icons';
import { FaFacebook, FaGlobe, FaInstagram, FaLink, FaTiktok, FaWhatsapp } from 'react-icons/fa';

const ICONS: Record<string, IconType> = {
  INSTAGRAM: FaInstagram,
  FACEBOOK: FaFacebook,
  TIKTOK: FaTiktok,
  WHATSAPP: FaWhatsapp,
  WEBSITE: FaGlobe,
  CUSTOM_URL: FaLink,
};

/** Icon for a destination row, by its DestinationType string. Falls back to a generic link icon. */
export function destinationIcon(type: string): IconType {
  return ICONS[type] ?? FaLink;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/unit/lib/destination-icon.test.tsx`
Expected: PASS (7/7).

- [ ] **Step 7: Write the failing landing-page tests**

Create/extend `tests/unit/components/landing-client.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LandingClient } from '@/app/(redirect)/s/[slug]/landing-client';
import { scanQueries } from '@/domains/scan/api/queries';

function renderWithData(payload: ReturnType<typeof scanQueries.landing>['queryFn'] extends () => Promise<infer T> ? T : never) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(scanQueries.landing('slug-one').queryKey, payload);
  return render(
    <QueryClientProvider client={client}>
      <LandingClient slug="slug-one" />
    </QueryClientProvider>,
  );
}

describe('LandingClient (linktree)', () => {
  afterEach(() => cleanup());

  it('shows a star row that links to the Google review URL for every star', () => {
    renderWithData({
      slug: 'slug-one',
      name: 'Cafe One',
      outcome: 'LANDING_SHOWN',
      links: [
        { id: 'd1', type: 'GOOGLE_REVIEW', label: null, url: 'https://search.google.com/local/writereview?placeid=abc' },
        { id: 'd2', type: 'INSTAGRAM', label: 'Instagram', url: 'https://instagram.com/cafe' },
      ],
    });

    const stars = screen.getAllByRole('link', { name: /rate \d star/i });
    expect(stars).toHaveLength(5);
    for (const star of stars) {
      expect(star).toHaveAttribute('href', 'https://search.google.com/local/writereview?placeid=abc');
    }
    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/cafe',
    );
  });

  it('omits the star row when there is no Google review destination', () => {
    renderWithData({
      slug: 'slug-one',
      name: 'Cafe One',
      outcome: 'LANDING_SHOWN',
      links: [{ id: 'd1', type: 'WEBSITE', label: 'Site', url: 'https://cafe.example' }],
    });
    expect(screen.queryByRole('link', { name: /rate 1 star/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/components/landing-client.test.tsx`
Expected: FAIL — no star row exists yet.

- [ ] **Step 9: Implement the linktree redesign**

Replace `app/(redirect)/s/[slug]/landing-client.tsx`:

```tsx
'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';

import { scanQueries } from '@/domains/scan/api/queries';
import { destinationIcon } from '@/lib/destination-icon';

export function LandingClient({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(scanQueries.landing(slug));

  if (data.outcome === 'INACTIVE') {
    return (
      <div className="w-full max-w-md text-center" data-testid="landing-inactive">
        <h1 className="text-xl font-semibold">This device is inactive</h1>
        <p className="mt-2 text-muted-foreground">
          The owner has paused this landing page. Please try again later.
        </p>
      </div>
    );
  }

  const reviewLink = data.links.find((link) => link.type === 'GOOGLE_REVIEW');
  const otherLinks = data.links.filter((link) => link.type !== 'GOOGLE_REVIEW');

  return (
    <div className="w-full max-w-md text-center" data-testid="landing-page">
      <header>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap or scan opened this page — pick a link below.
        </p>
      </header>

      {reviewLink && (
        <div className="mt-6 flex justify-center gap-1" role="group" aria-label="Rate us">
          {[1, 2, 3, 4, 5].map((star) => (
            <a
              key={star}
              href={reviewLink.url}
              aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
              className="text-amber-400 hover:text-amber-500"
            >
              <Star className="size-8 fill-current" />
            </a>
          ))}
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {otherLinks.map((link) => {
          const Icon = destinationIcon(link.type);
          return (
            <li key={link.id}>
              <a
                href={link.url}
                className="flex items-center gap-3 rounded border p-4 text-left font-medium hover:bg-muted"
              >
                <Icon className="size-5 shrink-0" />
                <span className="block">{link.label ?? link.type}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/components/landing-client.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 11: Run the full unit suite**

Run: `npx vitest run`
Expected: all pass (confirms the pre-existing `landing-page`/`landing-inactive` `data-testid`s and single-link `REDIRECTED` behavior in `page.tsx` are untouched — that server-side branch isn't part of this task).

- [ ] **Step 12: Commit**

```bash
git add lib/destination-icon.tsx "app/(redirect)/s/[slug]/landing-client.tsx" package.json package-lock.json tests/unit/lib/destination-icon.test.tsx tests/unit/components/landing-client.test.tsx
git commit -m "feat: redesign the public links page as a linktree with a star-rating row"
```

---

## Task 9: Dashboard pruning — permissions, nav, and the devices actions dropdown

**Files:**
- Modify: `db/seed/permissions.ts`
- Modify: `app/(dashboard)/devices/devices-client.tsx`
- Modify: `domains/device/server/actions.ts`
- Test: `tests/unit/seed/permissions.test.ts` (new, or extend existing seed test if present)
- Test: extend `tests/unit/components/` devices-client test if one exists

**Interfaces:**
- Produces: `forgetDeviceAction(id: string): Promise<ActionResult<{ device: DeviceSummary; claimCode: string }>>` in `domains/device/server/actions.ts`.

- [ ] **Step 1: Check for existing seed/permissions and devices-client tests**

Run: `find tests/unit -iname "*permission*" -o -iname "*devices-client*"`

Extend whichever files exist; create new ones per the steps below only if none do.

- [ ] **Step 2: Write the failing permissions test**

Create/extend a test asserting the pruned rows, e.g. `tests/unit/seed/permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PERMISSION_ROWS } from '@/db/seed/permissions';

describe('PERMISSION_ROWS after dashboard pruning', () => {
  it('no longer has a /devices/claim menu row', () => {
    expect(PERMISSION_ROWS.some((r) => r.path === '/devices/claim')).toBe(false);
  });

  it('no longer has the api.claim_device row (superseded by /s/[slug] flow)', () => {
    expect(PERMISSION_ROWS.some((r) => r.path === '/api/device/claim')).toBe(false);
  });

  it('has an api.forget_device row scoped to owners', () => {
    expect(PERMISSION_ROWS.some((r) => r.path === '/api/device/forget')).toBe(true);
  });
});
```

Add a second file (or extend the same one) checking `LINK_ROWS`:

```ts
import { LINK_ROWS_FOR_TEST } from '@/db/seed/permissions'; // see Step 4 note below

it('/merchants is admin-only', () => {
  const row = LINK_ROWS_FOR_TEST.find((r) => r.path === '/merchants');
  expect(row?.merchantScope).toBeUndefined();
});
```

Note: `LINK_ROWS` is currently module-private (not exported) in `db/seed/permissions.ts`. Export it as `export const LINK_ROWS = [...]` (rename the `const LINK_ROWS` declaration to `export const LINK_ROWS`) so this test — and the seed self-check — can read it directly; then import it as `LINK_ROWS` (drop the `LINK_ROWS_FOR_TEST` alias above, that was illustrative only — import the real exported name).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/seed/permissions.test.ts`
Expected: FAIL — `/devices/claim` and `/api/device/claim` still present, `/api/device/forget` missing, `LINK_ROWS` not exported.

- [ ] **Step 4: Update `db/seed/permissions.ts`**

In `PERMISSION_ROWS`:
- Delete the `{ path: '/devices/claim', ... }` menu row.
- Delete the `{ path: '/api/device/claim', ... }` API row.
- Add a new API row after `/api/device/reset`:

```ts
  {
    path: '/api/device/forget',
    label: 'api.forget_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
```

Export `LINK_ROWS` (`const LINK_ROWS` → `export const LINK_ROWS`), then in it:
- Delete the `{ path: '/devices/claim', ... }` and `{ path: '/api/device/claim', ... }` entries.
- Change `{ path: '/merchants', admin: true, merchantScope: null }` to `{ path: '/merchants', admin: true }` (omit `merchantScope` entirely so `ensureLink` is only called for `ADMIN`; check `ensurePermissions`'s loop — it unconditionally calls `ensureLink(db, roleIds, 'MERCHANT', ...)` for every row regardless of whether `merchantScope` is set, so omitting the field alone won't stop the MERCHANT link).

Because of that, also adjust the loop in `ensurePermissions` (bottom of the same file) so a row can opt out of the MERCHANT link entirely:

```ts
const LINK_ROWS: Array<{
  path: string;
  admin: boolean;
  merchant?: boolean; // default true; set false to admin-gate a route
  merchantScope?: 'owner' | 'member' | 'both' | null;
}> = [
  // ...
  { path: '/merchants', admin: true, merchant: false },
  // ...
];
```

And in `ensurePermissions`:

```ts
  for (const link of LINK_ROWS) {
    const permissionId = permIds.get(link.path);
    if (!permissionId) continue;
    if (link.admin) {
      await ensureLink(db, roleIds, 'ADMIN', permissionId, null, now);
    }
    if (link.merchant !== false) {
      await ensureLink(db, roleIds, 'MERCHANT', permissionId, link.merchantScope ?? null, now);
    }
  }
```

Add a new `LINK_ROWS` entry for the forget permission (owner-only, matching `/api/device/reset`'s pattern):

```ts
  { path: '/api/device/forget', admin: true, merchantScope: 'owner' },
```

- [ ] **Step 5: Run the permissions tests to verify they pass**

Run: `npx vitest run tests/unit/seed/permissions.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full unit suite to catch any other reference to the removed rows**

Run: `npx vitest run`
Expected: PASS. If `tests/unit` has an e2e-permission-table snapshot test or similar asserting the full `PERMISSION_ROWS`/`LINK_ROWS` length or contents, update its expected counts/paths to match.

- [ ] **Step 7: Add `forgetDeviceAction`**

In `domains/device/server/actions.ts`, add after `resetDeviceAction` and import `ownerForgetDevice`:

```ts
import {
  adminCreate,
  adminRenameDevice,
  adminReset,
  adminSetDisabled,
  deleteDevice,
  ownerForgetDevice,
  ownerReset,
  publishVisible,
  renameVisibleDevice,
  transfer,
  unpublishVisible,
} from './service';

// ...

/** Owner detaches a device from their org entirely: wipes config, releases it back to UNCLAIMED. */
export async function forgetDeviceAction(
  id: string,
): Promise<ActionResult<{ device: DeviceSummary; claimCode: string }>> {
  try {
    await requireApiPermission('/api/device/forget');
    const user = await requireApiUser(['MERCHANT']);
    const membership = await getActiveOrganization(user.id);
    if (!membership || !isOwner(membership)) {
      return fail('Only an organization owner can forget this device');
    }
    const result = await ownerForgetDevice(id, membership.organizationId);
    revalidatePath('/devices');
    return ok(result);
  } catch (err) {
    return fail(toMessage(err));
  }
}
```

- [ ] **Step 8: Wire "Forgot device" into the devices dropdown, drop the /devices/[id] link and /devices/claim CTA**

In `app/(dashboard)/devices/devices-client.tsx`:

- Import `forgetDeviceAction` alongside the existing device action imports.
- Add `const [pendingForget, setPendingForget] = useState<DeviceSummary | null>(null);` next to `pendingReset`.
- Add a `forget` mutation next to `reset`:

```ts
  const forget = useAction((id: string) => forgetDeviceAction(id), {
    successMsg: 'Device forgotten — it is now unclaimed',
    keys: [deviceKeys.lists()],
    onSuccess: () => setPendingForget(null),
  });
```

- In the `name` column's cell, replace the `Link` with plain text (the `/devices/[id]` route is being deleted):

```tsx
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
```

- In `createActionsColumn`, add the Forgot device entry after the conditional Reset entry:

```ts
    createActionsColumn<DeviceSummary>((device) => [
      { label: 'Edit', onClick: () => setPendingEdit(device) },
      ...(device.status === 'PUBLISHED'
        ? [{ label: 'Unpublish', onClick: () => setPendingPub({ device, action: 'unpublish' }) }]
        : device.status !== 'DISABLED'
          ? [{ label: 'Publish', onClick: () => setPendingPub({ device, action: 'publish' }) }]
          : []),
      ...(isOwner
        ? [
            { label: 'Reset', onClick: () => setPendingReset(device) },
            { label: 'Forgot device', variant: 'destructive' as const, onClick: () => setPendingForget(device) },
          ]
        : []),
    ]),
```

- Replace the empty-state block (which links to `/devices/claim`) — there is no longer a dashboard claim page, so point merchants at their device instead:

```tsx
  if (devices.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">No devices yet</h1>
        <p className="mt-2 text-muted-foreground">
          Scan or open your device's link to activate it — it will show up here once claimed.
        </p>
      </div>
    );
  }
```

- Remove the `actions={<Button render={<Link href="/devices/claim" />} ...>}` prop from the `<DataTable>` call entirely (drop the `actions` prop along with the now-unused `Link` import if nothing else in the file uses `Link` — check with `grep -n "Link" app/(dashboard)/devices/devices-client.tsx` after this edit).
- Add a new `AlertDialog` for `pendingForget`, mirroring the existing `pendingReset` one:

```tsx
      <AlertDialog
        open={pendingForget !== null}
        onOpenChange={(open) => setPendingForget(open ? pendingForget : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget {pendingForget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Detaches this device from your merchant, clears its links, and issues a new claim
              code for its next owner. This cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={forget.isPending}
              onClick={() => pendingForget && forget.mutate(pendingForget.id)}
            >
              {forget.isPending ? 'Forgetting…' : 'Forget device'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 9: Run/extend the devices-client test**

Run: `find tests/unit -iname "*devices-client*"` — if one exists, add a case asserting the "Forgot device" action opens the confirmation and calls `forgetDeviceAction`, following the same render/mock pattern as its existing "Reset" test. If none exists, this step is a no-op (out of scope to retrofit full coverage for a component this plan is only editing, not introducing) — but do add one assertion smoke-test:

```tsx
// tests/unit/components/devices-client.test.tsx (new, minimal)
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesClient } from '@/app/(dashboard)/devices/devices-client';
import { deviceQueries } from '@/domains/device/api/queries';
import { forgetDeviceAction } from '@/domains/device/server/actions';

vi.mock('@/domains/device/server/actions', () => ({
  publishDeviceAction: vi.fn(),
  unpublishDeviceAction: vi.fn(),
  resetDeviceAction: vi.fn(),
  forgetDeviceAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DEVICE = {
  id: 'dev-1',
  slug: 'dev-1-slug',
  name: 'Device One',
  status: 'CLAIMED' as const,
  createdAt: new Date().toISOString(),
};

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(deviceQueries.list().queryKey, [DEVICE]);
  return render(
    <QueryClientProvider client={client}>
      <DevicesClient isOwner />
    </QueryClientProvider>,
  );
}

describe('DevicesClient row actions', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it('forgets a device after confirmation', async () => {
    vi.mocked(forgetDeviceAction).mockResolvedValue({
      ok: true,
      data: { device: { ...DEVICE, status: 'UNCLAIMED' }, claimCode: 'NEWCODE1' },
    });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: /open actions/i }));
    fireEvent.click(screen.getByText('Forgot device'));
    fireEvent.click(screen.getByRole('button', { name: /forget device/i }));
    await waitFor(() => expect(forgetDeviceAction).toHaveBeenCalledWith('dev-1'));
  });
});
```

Run: `npx vitest run tests/unit/components/devices-client.test.tsx`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add db/seed/permissions.ts app/\(dashboard\)/devices/devices-client.tsx domains/device/server/actions.ts tests/unit
git commit -m "feat: prune claim-a-device nav/route, add Forgot device to the devices dropdown"
```

---

## Task 10: Delete the superseded dashboard routes

**Files:**
- Delete: `app/(dashboard)/devices/[id]/*`
- Delete: `app/(dashboard)/devices/claim/*`
- Delete: `app/(dashboard)/user-management/[memberId]/*`
- Modify: `tests/e2e/*` (any spec visiting the deleted routes)

**Interfaces:** none (deletion-only task).

- [ ] **Step 1: Find every reference to the routes being deleted**

Run: `grep -rn "devices/\[id\]\|devices/claim\|user-management/\[memberId\]\|/devices/\${" app tests domains --include=*.ts --include=*.tsx | grep -v node_modules`

Review each hit. By this point in the plan, `devices-client.tsx` no longer links to `/devices/claim` or `/devices/${id}` (Task 9). Any remaining hits are likely in `admin-devices-client.tsx` (check whether it links to `/devices/[id]` — if so, apply the same "plain text, not a link" treatment as Task 9 Step 8), test files, and e2e specs.

- [ ] **Step 2: Fix any remaining source references found in Step 1**

For each file found (other than tests), replace the dead link with plain text or remove the link wrapper, following the same pattern used in Task 9 Step 8.

- [ ] **Step 3: Update or remove affected e2e specs**

Run: `grep -rln "devices/\[id\]\|/devices/[a-z0-9-]*[^m]/settings\|devices/claim\|user-management/[a-z0-9-]" tests/e2e`

For each spec that navigates to one of the deleted routes: if the spec's purpose was specifically testing that route's page (e.g. a device settings page test), delete the spec file. If the route visit was incidental to a broader flow, update it to use the new equivalent (the devices dropdown actions from Task 9, or `/s/[slug]/option` from Task 7).

- [ ] **Step 4: Delete the route folders**

```bash
git rm -r "app/(dashboard)/devices/[id]"
git rm -r "app/(dashboard)/devices/claim"
git rm -r "app/(dashboard)/user-management/[memberId]"
```

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. Any failure here means Step 1–3 missed a reference — fix it and rerun.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors referencing the deleted paths (stale `.next/types` cache entries for these paths are expected and harmless — they clear on the next `next dev`/`next build`, as seen earlier in this project's setup work).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove /devices/[id], /devices/claim, /user-management/[memberId]"
```

---

## Task 11: E2E coverage for the owner/reseller round trip

**Files:**
- Create: `tests/e2e/device-option-flow.spec.ts`
- Modify: `db/seed/e2e.ts` (add a second unclaimed device + an owner account, if not already present)

**Interfaces:** none new — exercises the actions/pages built in Tasks 4–9 end to end.

- [ ] **Step 1: Check the e2e seed for a reusable owner account and an org-less unclaimed device**

Run: `grep -n "UNCLAIMED\|owner" db/seed/e2e.ts`

If the seed already has an owner-role e2e login and at least one `UNCLAIMED` device with `organizationId: null`, reuse them. Otherwise add a device row named e.g. `e2e-unclaimed-2` (distinct from any device already used by `tests/e2e/setup-claim.spec.ts`, to avoid state collisions across spec runs) with `organizationId: null`, and confirm the existing e2e owner credentials are exported/known (check how `tests/e2e/setup-claim.spec.ts`'s sibling specs authenticate — likely a `storageState` fixture or a login helper under `tests/e2e/`).

- [ ] **Step 2: Write the E2E spec**

Create `tests/e2e/device-option-flow.spec.ts`, adapting the login mechanism to match whatever helper the existing suite uses (inspect `tests/e2e/` for a `loginAs`/`storageState` pattern before writing this):

```ts
import { expect, test } from '@playwright/test';

/**
 * Owner/reseller post-claim branch (spec: docs/superpowers/specs/
 * 2026-09-18-device-claim-reseller-flow-design.md).
 */
test.describe('device option flow (org owner, org-less device)', () => {
  test('entering the claim code as a signed-in owner skips straight to /option', async ({ page }) => {
    // Sign in as the e2e owner account first (see Step 1 — use this suite's
    // existing login helper/storageState rather than re-deriving credentials here).
    await page.goto('/s/e2e-unclaimed-2/setup');
    await page.getByLabel('Claim code').fill('E2ECLAIM2');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/s\/e2e-unclaimed-2\/option$/);
    await expect(page.getByRole('button', { name: /claim for yourself/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^resell$/i })).toBeVisible();
  });

  test('resell resets the device back to unclaimed with a new code', async ({ page }) => {
    await page.goto('/s/e2e-unclaimed-2/option');
    await page.getByRole('button', { name: /^resell$/i }).click();
    await page.getByRole('button', { name: /^confirm$/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    // Re-opening the setup flow with the OLD code now fails (rotated).
    await page.goto('/s/e2e-unclaimed-2/setup');
    await page.getByLabel('Claim code').fill('E2ECLAIM2');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Set up your device' })).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the e2e spec**

Run: `npx playwright test tests/e2e/device-option-flow.spec.ts`
Expected: PASS. If the login mechanism assumed in Step 2 doesn't match the project's actual e2e auth helper, this will fail at the first `page.goto`/auth step — fix the setup to match whatever `tests/e2e/setup-claim.spec.ts`'s neighboring specs actually use (re-read that directory's shared fixtures before adjusting).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/device-option-flow.spec.ts db/seed/e2e.ts
git commit -m "test: cover the owner claim-vs-resell round trip end to end"
```

---

## Task 12: Final verification pass

- [ ] **Step 1: Full unit + coverage run**

Run: `npx vitest run --coverage`
Expected: all tests pass; no unexpected coverage drop in `domains/device`, `domains/merchant`, or `lib`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors outside the pre-existing, unrelated `tests/unit/api-factories.test.ts` finding noted during the earlier setup-flow work (verify it's still the only pre-existing failure, not a new one).

- [ ] **Step 3: Lint the touched areas**

Run: `npx biome check "app/(redirect)/s/[slug]" "app/(dashboard)/devices" domains lib db/seed`
Expected: no new findings beyond the project's existing CRLF-only baseline warnings (see the earlier setup-flow commits in this branch for what that baseline looks like).

- [ ] **Step 4: Full e2e run**

Run: `npx playwright test`
Expected: all pass.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, then walk through by hand:
1. As an anonymous visitor: open an unclaimed device's `/s/[slug]/setup`, enter its code, confirm you land on the destination editor (not `/option`).
2. As a signed-in org owner: open a different org-less unclaimed device's `/s/[slug]/setup`, enter its code, confirm you land on `/option`, and that both Claim/Resell round-trip correctly.
3. On `/dashboard/devices` (or wherever the merchant device list lives — confirm the actual path from `app/(dashboard)/devices/page.tsx`), confirm the row dropdown shows Edit/Publish-or-Unpublish/Reset/Forgot device for an owner, and that Forgot device works.
4. Open a `PUBLISHED` device with 2+ destinations including a `GOOGLE_REVIEW` one at `/s/[slug]`, confirm the star row renders and every star opens the same Google review URL, and the icon-linktree rows render with the right icons.
5. Confirm `/merchants` no longer appears in a merchant's sidebar, and `/devices/claim` is gone.

- [ ] **Step 6: Final commit if any smoke-test fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found in final smoke test"
```
