import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, isNotNull, like, ne, or } from 'drizzle-orm';

import { getDb } from '@/db';
import { account, device, member, merchantProfile, organization, session, user } from '@/db/schema';
import { claimDeviceSchema } from '@/domains/device/schemas';
import type { DeviceSummary } from '@/domains/device/types';
import { type ProfileOutput, profileSchema } from '@/domains/merchant/schemas/profile';
import {
  getActiveOrganization,
  isOwner,
  type Membership,
} from '@/domains/merchant/server/permissions';
import { auth } from '@/lib/auth';
import { hashClaimCode, randomSlug } from '@/lib/codes';
import { AppError } from '@/lib/errors';

type DeviceRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  organizationId: string | null;
  memberId: string | null;
  boundUserId: string | null;
  createdAt: Date;
};

function toDeviceSummary(row: DeviceRow): DeviceSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as DeviceSummary['status'],
    createdAt: row.createdAt.toISOString(),
  };
}

function toDto(row: {
  id: number;
  userId: string;
  businessName: string;
  phone: string | null;
  country: string | null;
}): ProfileOutput {
  return row;
}

export async function upsertProfile(userId: string, input: unknown): Promise<ProfileOutput> {
  const { businessName, phone, country } = profileSchema.parse(input);
  const db = getDb();
  const now = new Date();

  const existing = await db.query.merchantProfile.findFirst({
    where: eq(merchantProfile.userId, userId),
  });

  if (existing) {
    await db
      .update(merchantProfile)
      .set({ businessName, phone: phone ?? null, country: country ?? null, updatedAt: now })
      .where(eq(merchantProfile.userId, userId));
  } else {
    await db.insert(merchantProfile).values({
      userId,
      businessName,
      phone: phone ?? null,
      country: country ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const row = await db.query.merchantProfile.findFirst({
    where: eq(merchantProfile.userId, userId),
  });
  if (!row) throw new AppError(500, 'PROFILE_CREATE_FAILED', 'Failed to save merchant profile');
  return toDto(row);
}

export async function getProfileByUserId(userId: string): Promise<ProfileOutput | null> {
  const row = await getDb().query.merchantProfile.findFirst({
    where: eq(merchantProfile.userId, userId),
  });
  return row ? toDto(row) : null;
}

export type MerchantWithDevices = ProfileOutput & {
  email: string;
  deviceCount: number;
  organizationId: string | null;
};

export async function listMerchants(): Promise<MerchantWithDevices[]> {
  const db = getDb();
  const profiles = await db
    .select({
      id: merchantProfile.id,
      userId: merchantProfile.userId,
      businessName: merchantProfile.businessName,
      phone: merchantProfile.phone,
      country: merchantProfile.country,
      email: user.email,
    })
    .from(merchantProfile)
    .innerJoin(user, eq(user.id, merchantProfile.userId));

  const counts = await db
    .select({ ownerId: device.ownerId, cnt: count() })
    .from(device)
    .groupBy(device.ownerId);

  const countByOwner = new Map<number, number>();
  for (const c of counts) {
    if (c.ownerId !== null) countByOwner.set(c.ownerId, c.cnt);
  }

  const ownerRows = await db
    .select({ userId: member.userId, organizationId: member.organizationId })
    .from(member)
    .where(eq(member.role, 'owner'));
  const orgByOwner = new Map(ownerRows.map((r) => [r.userId, r.organizationId]));

  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    businessName: p.businessName,
    phone: p.phone,
    country: p.country,
    email: p.email,
    deviceCount: countByOwner.get(p.id) ?? 0,
    organizationId: orgByOwner.get(p.userId) ?? null,
  }));
}

export type OrganizationWithDevices = {
  id: string;
  name: string;
  slug: string;
  deviceCount: number;
};

/** Admin view: reseller organizations with their device counts (FR-018/FR-026). */
export async function listOrganizations(): Promise<OrganizationWithDevices[]> {
  const db = getDb();
  const orgs = await db.query.organization.findMany();
  const counts = await db
    .select({ organizationId: device.organizationId, cnt: count() })
    .from(device)
    .where(isNotNull(device.organizationId))
    .groupBy(device.organizationId);

  const countByOrg = new Map<string, number>();
  for (const c of counts) {
    if (c.organizationId !== null) countByOrg.set(c.organizationId, c.cnt);
  }

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    deviceCount: countByOrg.get(o.id) ?? 0,
  }));
}

export type Paginated<T> = { rows: T[]; total: number; page: number; limit: number };

function pageParams(page?: number, limit?: number): { page: number; limit: number } {
  return {
    page: Math.max(1, Math.floor(page ?? 1)),
    limit: Math.min(100, Math.max(1, Math.floor(limit ?? 10))),
  };
}

/** Every platform account (FR-055 + admin parity): org members AND accounts
 * with no organization yet (platform ADMINs, freshly-seeded MERCHANTs). A
 * user without a membership has `memberId`/`role`/`organizationId` null. */
export type AdminUserRow = {
  id: string;
  memberId: string | null;
  userId: string;
  name: string;
  email: string;
  platformRole: 'ADMIN' | 'MERCHANT';
  role: 'owner' | 'member' | null;
  deviceCount: number;
  organizationId: string | null;
  organizationName: string | null;
};

/**
 * Admin server-driven user list (FR-055). Debounced `q` searches name/email
 * (MySQL `LIKE` is case-insensitive under the default utf8mb4 collation),
 * optional org filter, server-side pagination + total. Never used for
 * client-side filtering. Left-joined from `user` (not `member`) so accounts
 * without an organization still show up.
 */
export async function listUsers(opts: {
  q?: string;
  organizationId?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<AdminUserRow>> {
  const db = getDb();
  const { page, limit } = pageParams(opts.page, opts.limit);
  const conds = [
    ...(opts.organizationId ? [eq(member.organizationId, opts.organizationId)] : []),
    ...(opts.q
      ? [or(like(user.name, `%${opts.q.trim()}%`), like(user.email, `%${opts.q.trim()}%`))]
      : []),
  ];
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      memberId: member.id,
      userId: user.id,
      role: member.role,
      organizationId: member.organizationId,
      name: user.name,
      email: user.email,
      platformRole: user.role,
      organizationName: organization.name,
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .leftJoin(organization, eq(organization.id, member.organizationId))
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const countByMember = await memberDeviceCounts();
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .where(where);

  return {
    rows: rows.map((r) => ({
      id: r.memberId ?? r.userId,
      memberId: r.memberId,
      userId: r.userId,
      role: r.role as AdminUserRow['role'],
      name: r.name,
      email: r.email,
      platformRole: r.platformRole as AdminUserRow['platformRole'],
      deviceCount: r.memberId ? (countByMember.get(r.memberId) ?? 0) : 0,
      organizationId: r.organizationId,
      organizationName: r.organizationName,
    })),
    total: cnt,
    page,
    limit,
  };
}

/** Admin server-driven organization (merchant) list with device counts (FR-055). */
export async function searchOrganizations(opts: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<OrganizationWithDevices>> {
  const db = getDb();
  const { page, limit } = pageParams(opts.page, opts.limit);
  const where = opts.q ? like(organization.name, `%${opts.q.trim()}%`) : undefined;

  const orgs = await db.query.organization.findMany({
    where,
    orderBy: asc(organization.name),
    limit,
    offset: (page - 1) * limit,
  });
  const counts = await db
    .select({ organizationId: device.organizationId, cnt: count() })
    .from(device)
    .where(isNotNull(device.organizationId))
    .groupBy(device.organizationId);
  const countByOrg = new Map<string, number>();
  for (const c of counts) {
    if (c.organizationId !== null) countByOrg.set(c.organizationId, c.cnt);
  }
  const [{ cnt }] = await db.select({ cnt: count() }).from(organization).where(where);

  return {
    rows: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      deviceCount: countByOrg.get(o.id) ?? 0,
    })),
    total: cnt,
    page,
    limit,
  };
}

// ---------------------------------------------------------------------------
// Claim-code account flows (FR-001/005/023/024)
// ---------------------------------------------------------------------------

async function findDeviceByClaimCode(claimCode: string): Promise<DeviceRow> {
  const row = await getDb().query.device.findFirst({
    where: eq(device.claimCodeHash, hashClaimCode(claimCode)),
  });
  if (!row) throw new AppError(404, 'INVALID_CLAIM', 'Claim code not found');
  return row;
}

/** Resolver that hands a fresh claim: adopt caller's org when the device has none. */
function resolveOrgForCaller(
  candidate: { organizationId: string | null },
  membership: Membership,
): string {
  if (candidate.organizationId && candidate.organizationId !== membership.organizationId) {
    throw new AppError(409, 'ORG_MISMATCH', 'This device belongs to another organization');
  }
  return candidate.organizationId ?? membership.organizationId;
}

export type RegisterWithClaimCodeInput = {
  claimCode: string;
  name: string;
  email: string;
  password: string;
};

/**
 * FR-024: a brand-new user registers with a claim code. Creates the account,
 * joins the device's organization as `member`, and binds the device.
 */
export async function registerWithClaimCode(input: RegisterWithClaimCodeInput): Promise<{
  role: 'MERCHANT';
  deviceId: string;
  slug: string;
}> {
  const { claimCode } = claimDeviceSchema.parse({ claimCode: input.claimCode });
  const db = getDb();
  const row = await findDeviceByClaimCode(claimCode);

  if (row.boundUserId) {
    throw new AppError(409, 'ALREADY_BOUND', 'This code is already linked to an account');
  }
  if (!row.organizationId) {
    throw new AppError(
      409,
      'NO_ORGANIZATION',
      'This device is not linked to a reseller organization yet — contact the seller',
    );
  }

  const { user: created } = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  if (!created) throw new AppError(500, 'SIGNUP_FAILED', 'Could not create the account');

  await db
    .update(user)
    .set({ role: 'MERCHANT', emailVerified: true })
    .where(eq(user.id, created.id));
  await auth.api.addMember({
    body: { userId: created.id, organizationId: row.organizationId, role: 'member' },
  });

  const membership = await db.query.member.findFirst({
    where: and(eq(member.userId, created.id), eq(member.organizationId, row.organizationId)),
  });
  await db
    .update(device)
    .set({
      boundUserId: created.id,
      memberId: membership?.id ?? null,
      status: 'CLAIMED',
      updatedAt: new Date(),
    })
    .where(eq(device.id, row.id));

  return { role: 'MERCHANT', deviceId: row.id, slug: row.slug };
}

/**
 * FR-005/023: a logged-in merchant (owner or member) claims a device with a
 * claim code, binding it to their account and organization. Owners adopting an
 * unassigned device get it added to their org (no separate login step).
 */
export async function claimWithCode(
  userId: string,
  membership: Membership,
  claimCode: string,
): Promise<DeviceSummary> {
  const row = await findDeviceByClaimCode(claimCode);
  const db = getDb();

  if (row.boundUserId !== null && row.boundUserId !== userId) {
    throw new AppError(
      409,
      'ALREADY_BOUND',
      'This code is already linked to another account — sign in with that account instead',
    );
  }

  const organizationId = resolveOrgForCaller(row, membership);
  await db
    .update(device)
    .set({
      organizationId,
      memberId: membership.id,
      boundUserId: userId,
      status: 'CLAIMED',
      updatedAt: new Date(),
    })
    .where(eq(device.id, row.id));

  return toDeviceSummary({
    ...row,
    status: 'CLAIMED',
    organizationId,
    memberId: membership.id,
    boundUserId: userId,
  });
}

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

// ---------------------------------------------------------------------------
// Member management (FR-021/022/027, US4)
// ---------------------------------------------------------------------------

export type MemberWithUser = {
  id: string;
  userId: string;
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
  user: { id: string; name: string; email: string };
};

function toMemberWithUser(row: MemberRow, deviceCount: number): MemberWithUser {
  return {
    id: row.id,
    userId: row.user.id,
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
  return members.sort((a, b) => (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1));
}

/** Admin cross-org view: group by organization (alpha), owner-first within each group. */
function sortByOrgThenOwnerFirst(members: MemberWithUser[]): MemberWithUser[] {
  return members.sort((a, b) => {
    const orgCompare = a.organizationName.localeCompare(b.organizationName);
    if (orgCompare !== 0) return orgCompare;
    if (a.role === b.role) return 0;
    return a.role === 'owner' ? -1 : 1;
  });
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
  return sortByOrgThenOwnerFirst(
    rows.map((r) => toMemberWithUser(r, countByMember.get(r.id) ?? 0)),
  );
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

// ---------------------------------------------------------------------------
// Admin user CRUD (FR-052/053, Phase 17) — DB-level by design: Better Auth's
// organization endpoints require the caller to be a member of the org, but the
// platform ADMIN has no membership, so these mutate member/org rows directly.
// ---------------------------------------------------------------------------

async function assertSingleOwner(organizationId: string, ownerRole: string): Promise<void> {
  if (ownerRole !== 'owner') return;
  const rows = await getDb()
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.role, 'owner')));
  if (rows.length <= 1) {
    throw new AppError(
      409,
      'LAST_OWNER',
      'This is the only owner of the merchant. Reassign ownership to another account first.',
    );
  }
}

/** Admin creates a platform account and joins it to an organization (no invitation, FR-052). */
export async function createUser(opts: {
  name: string;
  email: string;
  password: string;
  organizationId: string;
  role: 'owner' | 'member';
}): Promise<MemberWithUser> {
  const db = getDb();
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, opts.organizationId),
  });
  if (!org) throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Select an existing merchant');
  const emailTaken = await db.query.user.findFirst({ where: eq(user.email, opts.email) });
  if (emailTaken)
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');

  // Create the account directly via Better Auth's internal adapter rather than
  // auth.api.signUpEmail: signUpEmail always establishes a session for the new
  // user (via the nextCookies plugin), which would silently log the acting
  // admin out and into the account they just created.
  const authContext = await auth.$context;
  const created = await authContext.internalAdapter.createUser(
    {
      name: opts.name,
      email: opts.email,
      emailVerified: true,
      role: 'MERCHANT',
      status: 'ACTIVE',
    },
    { method: 'admin' },
  );
  if (!created) throw new AppError(500, 'SIGNUP_FAILED', 'Could not create the account');
  const hashedPassword = await authContext.password.hash(opts.password);
  await authContext.internalAdapter.linkAccount({
    providerId: 'credential',
    accountId: created.id,
    password: hashedPassword,
    userId: created.id,
  });
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: opts.organizationId,
    userId: created.id,
    role: opts.role,
    createdAt: new Date(),
  });

  const row = await db.query.member.findFirst({
    where: and(eq(member.organizationId, opts.organizationId), eq(member.userId, created.id)),
    with: { user: true, organization: true },
  });
  if (!row) throw new AppError(500, 'MEMBER_CREATE_FAILED', 'Could not create the membership');
  const countByMember = await memberDeviceCounts();
  return toMemberWithUser(row, countByMember.get(row.id) ?? 0);
}

async function changeUserEmail(userId: string, email: string, otherThanUserId: string) {
  const db = getDb();
  const taken = await db.query.user.findFirst({
    where: (t) => and(eq(t.email, email), ne(t.id, otherThanUserId)),
  });
  if (taken) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
  await db.update(user).set({ email, updatedAt: new Date() }).where(eq(user.id, userId));
  // Keep the email+password credential in sync so the new email can sign in.
  await db
    .update(account)
    .set({ accountId: email })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'email')));
}

async function moveMembership(
  memberRow: { id: string; organizationId: string; userId: string; role: string },
  toOrganizationId: string,
  role: 'owner' | 'member',
): Promise<string> {
  const db = getDb();
  if (memberRow.role === 'owner') {
    await assertSingleOwner(memberRow.organizationId, memberRow.role);
  }
  const existing = await db.query.member.findFirst({
    where: and(eq(member.organizationId, toOrganizationId), eq(member.userId, memberRow.userId)),
  });
  let newMemberId: string;
  if (existing) {
    newMemberId = existing.id;
    await db.update(member).set({ role }).where(eq(member.id, existing.id));
  } else {
    newMemberId = randomUUID();
    await db.insert(member).values({
      id: newMemberId,
      organizationId: toOrganizationId,
      userId: memberRow.userId,
      role,
      createdAt: new Date(),
    });
  }
  // Devices assigned to the old membership follow the user to the new org (FR-053).
  await db
    .update(device)
    .set({ memberId: newMemberId, updatedAt: new Date() })
    .where(eq(device.memberId, memberRow.id));
  await db.delete(member).where(eq(member.id, memberRow.id));
  return newMemberId;
}

/** Admin edits a user: rename, change email, change role, move between orgs (FR-053). */
export async function updateUser(opts: {
  memberId: string;
  name?: string;
  email?: string;
  role?: 'owner' | 'member';
  organizationId?: string;
}): Promise<MemberWithUser> {
  const db = getDb();
  const memberRow = await db.query.member.findFirst({
    where: eq(member.id, opts.memberId),
    with: { user: true, organization: true },
  });
  if (!memberRow) throw new AppError(404, 'MEMBER_NOT_FOUND', 'User not found');

  const finalRole: 'owner' | 'member' = opts.role ?? (memberRow.role as 'owner' | 'member');
  const moving =
    opts.organizationId !== undefined && opts.organizationId !== memberRow.organizationId;

  if (moving && memberRow.role === 'owner') {
    await assertSingleOwner(memberRow.organizationId, memberRow.role);
  }
  if (!moving && memberRow.role === 'owner' && finalRole === 'member') {
    await assertSingleOwner(memberRow.organizationId, memberRow.role);
  }

  if (opts.name && opts.name !== memberRow.user.name) {
    await db
      .update(user)
      .set({ name: opts.name, updatedAt: new Date() })
      .where(eq(user.id, memberRow.userId));
  }
  if (opts.email && opts.email !== memberRow.user.email) {
    await changeUserEmail(memberRow.userId, opts.email, memberRow.userId);
  }

  let targetMemberId = memberRow.id;
  if (moving) {
    if (!opts.organizationId) throw new AppError(400, 'ORG_REQUIRED', 'Select a merchant');
    targetMemberId = await moveMembership(memberRow, opts.organizationId, finalRole);
  } else if (opts.role && opts.role !== memberRow.role) {
    await db.update(member).set({ role: finalRole }).where(eq(member.id, memberRow.id));
  }
  const row = await db.query.member.findFirst({
    where: eq(member.id, targetMemberId),
    with: { user: true, organization: true },
  });
  if (!row) throw new AppError(500, 'USER_UPDATE_FAILED', 'Could not update the user');
  const countByMember = await memberDeviceCounts();
  return toMemberWithUser(row, countByMember.get(row.id) ?? 0);
}

/**
 * Admin deletes a user: removes their membership and deactivates the platform
 * account (sessions revoked so it is logged out everywhere). FR-052.
 */
export async function deactivateUser(memberId: string): Promise<void> {
  const db = getDb();
  const memberRow = await db.query.member.findFirst({
    where: eq(member.id, memberId),
    with: { user: true, organization: true },
  });
  if (!memberRow) throw new AppError(404, 'MEMBER_NOT_FOUND', 'User not found');
  if (memberRow.role === 'owner') {
    await assertSingleOwner(memberRow.organizationId, memberRow.role);
  }
  const userId = memberRow.userId;
  await db.delete(member).where(eq(member.id, memberId));
  await db
    .update(user)
    .set({ status: 'DEACTIVATED', updatedAt: new Date() })
    .where(eq(user.id, userId));
  await db.delete(session).where(eq(session.userId, userId));
}

// ---------------------------------------------------------------------------
// Admin organization (merchant) CRUD (FR-054, Phase 17)
// ---------------------------------------------------------------------------

export function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'merchant';
}

/**
 * Creates only the org shell — business name, NO owner (FR-054). Created
 * directly because Better Auth's createOrganization always makes the caller
 * the owner; the admin is not a member of the new merchant.
 */
export async function createOrganizationShell(name: string): Promise<OrganizationWithDevices> {
  const db = getDb();
  const trimmed = name.trim();
  let slug = slugifyName(trimmed);
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.organization.findFirst({
      where: eq(organization.slug, slug),
    });
    if (!existing) break;
    slug = `${slugifyName(trimmed)}-${randomSlug(4)}`;
  }
  await db.insert(organization).values({
    id: randomUUID(),
    name: trimmed,
    slug,
    logo: null,
    metadata: null,
    createdAt: new Date(),
  });
  const created = await db.query.organization.findFirst({
    where: eq(organization.slug, slug),
  });
  if (!created) throw new AppError(500, 'ORG_CREATE_FAILED', 'Could not create the merchant');
  return { id: created.id, name: created.name, slug: created.slug, deviceCount: 0 };
}

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

/** Assigns an owner to a merchant from an existing account (DB-level, admin is not an org member). */
export async function setOrgOwner(organizationId: string, ownerId: string): Promise<void> {
  const db = getDb();
  const userRow = await db.query.user.findFirst({ where: eq(user.id, ownerId) });
  if (!userRow) throw new AppError(404, 'USER_NOT_FOUND', 'Select an existing account as owner');
  const existing = await db.query.member.findFirst({
    where: and(eq(member.organizationId, organizationId), eq(member.userId, ownerId)),
  });
  if (existing) {
    if (existing.role !== 'owner') {
      await db.update(member).set({ role: 'owner' }).where(eq(member.id, existing.id));
    }
    return;
  }
  await db.insert(member).values({
    id: randomUUID(),
    organizationId,
    userId: ownerId,
    role: 'owner',
    createdAt: new Date(),
  });
}

/** Admin deletes a merchant org directly (rows cascade: members deleted, devices unbound). */
export async function deleteOrganizationAction(organizationId: string): Promise<void> {
  const org = await getDb().query.organization.findFirst({
    where: eq(organization.id, organizationId),
  });
  if (!org) throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Merchant not found');
  await getDb().delete(organization).where(eq(organization.id, organizationId));
}

async function assertMemberInOrg(memberId: string, organizationId: string) {
  const row = await getDb().query.member.findFirst({
    where: and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
  });
  if (!row) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found in this organization');
  return row;
}

async function assertDeviceInOrg(deviceId: string, organizationId: string) {
  const row = await getDb().query.device.findFirst({
    where: and(eq(device.id, deviceId), eq(device.organizationId, organizationId)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found in this organization');
  return row;
}

/** FR-027: assign a device to a sub-merchant member of the same organization. */
export async function assignDevice(
  deviceId: string,
  memberId: string,
  organizationId: string,
): Promise<void> {
  const db = getDb();
  await assertDeviceInOrg(deviceId, organizationId);
  await assertMemberInOrg(memberId, organizationId);
  await db.update(device).set({ memberId, updatedAt: new Date() }).where(eq(device.id, deviceId));
}

/** FR-027: remove a member assignment; the org owner still sees the device. */
export async function unassignDevice(deviceId: string, organizationId: string): Promise<void> {
  const db = getDb();
  await assertDeviceInOrg(deviceId, organizationId);
  await db
    .update(device)
    .set({ memberId: null, updatedAt: new Date() })
    .where(eq(device.id, deviceId));
}

/**
 * Admin renames a merchant directly (DB-level): the admin is not an org
 * member, so Better Auth's updateOrganization would reject the caller.
 */
export async function updateOrganizationName(organizationId: string, name: string): Promise<void> {
  const org = await getDb().query.organization.findFirst({
    where: eq(organization.id, organizationId),
  });
  if (!org) throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Merchant not found');
  await getDb()
    .update(organization)
    .set({ name: name.trim() })
    .where(eq(organization.id, organizationId));
}
