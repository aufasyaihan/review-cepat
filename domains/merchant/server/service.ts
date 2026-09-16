import { and, count, eq, isNotNull } from 'drizzle-orm';

import { getDb } from '@/db';
import { device, member, merchantProfile, organization, user } from '@/db/schema';
import { claimDeviceSchema } from '@/domains/device/schemas';
import type { DeviceSummary } from '@/domains/device/types';
import { type ProfileOutput, profileSchema } from '@/domains/merchant/schemas/profile';
import type { Membership } from '@/domains/merchant/server/permissions';
import { auth } from '@/lib/auth';
import { hashClaimCode } from '@/lib/codes';
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

export type MerchantWithDevices = ProfileOutput & { email: string; deviceCount: number };

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

  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    businessName: p.businessName,
    phone: p.phone,
    country: p.country,
    email: p.email,
    deviceCount: countByOwner.get(p.id) ?? 0,
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

// ---------------------------------------------------------------------------
// Member management (FR-021/022/027, US4)
// ---------------------------------------------------------------------------

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
