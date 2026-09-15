import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { destination, device, merchantProfile, organization, scanEvent } from '@/db/schema';
import { CLAIM_CODE_PATTERN, DEVICE_STATUS, type DeviceStatus } from '@/domains/device/constants';
import {
  claimDeviceSchema,
  createDeviceSchema,
  setupClaimCodeSchema,
  transferDeviceSchema,
} from '@/domains/device/schemas';
import type {
  CreateDeviceResult,
  DestinationDto,
  DeviceDetail,
  DeviceSummary,
} from '@/domains/device/types';
import { generateClaimCode, hashClaimCode, isValidSlug, randomSlug } from '@/lib/codes';
import { AppError } from '@/lib/errors';

function toSummmary(row: {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: Date;
  memberId?: string | null;
}): DeviceSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as DeviceStatus,
    createdAt: row.createdAt.toISOString(),
    memberId: row.memberId ?? null,
  };
}

function toDestinationDto(row: {
  id: string;
  type: string;
  label: string | null;
  url: string | null;
  placeId: string | null;
  position: number;
  active: boolean;
}): DestinationDto {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    url: row.url,
    placeId: row.placeId,
    position: row.position,
    active: row.active,
  };
}

async function findDevice(id: string) {
  return getDb().query.device.findFirst({ where: eq(device.id, id) });
}

async function readDeviceOrFail(id: string) {
  const row = await findDevice(id);
  if (!row) throw new AppError(500, 'DEVICE_READ_FAILED', 'Failed to reload device');
  return row;
}

async function ensureUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug(10);
    const existing = await getDb().query.device.findFirst({ where: eq(device.slug, slug) });
    if (!existing) return slug;
  }
  throw new AppError(500, 'SLUG_EXHAUSTED', 'Could not allocate a unique device slug');
}

export async function listOwned(ownerId: number): Promise<DeviceSummary[]> {
  const rows = await getDb().query.device.findMany({
    where: eq(device.ownerId, ownerId),
    orderBy: desc(device.createdAt),
  });
  return rows.map(toSummmary);
}

export async function getForOwner(id: string, ownerId: number): Promise<DeviceDetail> {
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), eq(device.ownerId, ownerId)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  const destinations = await db.query.destination.findMany({
    where: eq(destination.deviceId, id),
    orderBy: asc(destination.position),
  });
  return { ...toSummmary(row), destinations: destinations.map(toDestinationDto) };
}

export async function getById(id: string): Promise<DeviceDetail | null> {
  const db = getDb();
  const row = await db.query.device.findFirst({ where: eq(device.id, id) });
  if (!row) return null;
  const destinations = await db.query.destination.findMany({
    where: eq(destination.deviceId, id),
    orderBy: asc(destination.position),
  });
  return { ...toSummmary(row), destinations: destinations.map(toDestinationDto) };
}

export async function getBySlug(slug: string): Promise<DeviceDetail | null> {
  if (!isValidSlug(slug)) return null;
  return getById(
    await (async () => {
      const row = await getDb().query.device.findFirst({ where: eq(device.slug, slug) });
      return row?.id ?? '';
    })(),
  );
}

export type MembershipLike = {
  id: string;
  organizationId: string;
  role: 'owner' | 'member';
};

function orgAccessWhere(membership: MembershipLike) {
  return membership.role === 'owner'
    ? eq(device.organizationId, membership.organizationId)
    : and(eq(device.organizationId, membership.organizationId), eq(device.memberId, membership.id));
}

/**
 * Owner sees every device in their organization; a sub-merchant sees only the
 * devices assigned to them (data-model.md Authorization Visibility, SC-008).
 */
export async function listVisible(membership: MembershipLike): Promise<DeviceSummary[]> {
  const rows = await getDb().query.device.findMany({
    where: orgAccessWhere(membership),
    orderBy: desc(device.createdAt),
  });
  return rows.map(toSummmary);
}

export async function getVisible(id: string, membership: MembershipLike): Promise<DeviceDetail> {
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), orgAccessWhere(membership)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  const destinations = await db.query.destination.findMany({
    where: eq(destination.deviceId, id),
    orderBy: asc(destination.position),
  });
  return { ...toSummmary(row), destinations: destinations.map(toDestinationDto) };
}

export async function publishVisible(
  id: string,
  membership: MembershipLike,
): Promise<DeviceSummary> {
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), orgAccessWhere(membership)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  if (row.status === 'DISABLED')
    throw new AppError(409, 'DEVICE_DISABLED', 'Disabled devices cannot be published');
  if (!(await hasActiveDestination(id))) {
    throw new AppError(
      409,
      'NO_DESTINATIONS',
      'Add at least one active destination before publishing',
    );
  }
  await db
    .update(device)
    .set({ status: 'PUBLISHED', updatedAt: new Date() })
    .where(eq(device.id, id));
  return toSummmary(await readDeviceOrFail(id));
}

export async function unpublishVisible(
  id: string,
  membership: MembershipLike,
): Promise<DeviceSummary> {
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), orgAccessWhere(membership)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  if (row.status !== 'PUBLISHED') return toSummmary(row);
  await db
    .update(device)
    .set({ status: 'UNPUBLISHED', updatedAt: new Date() })
    .where(eq(device.id, id));
  return toSummmary(await readDeviceOrFail(id));
}

export async function claim(ownerId: number, input: unknown): Promise<DeviceSummary> {
  const { claimCode } = claimDeviceSchema.parse(input);
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: eq(device.claimCodeHash, hashClaimCode(claimCode)),
  });
  if (!row) throw new AppError(404, 'INVALID_CLAIM', 'Claim code not found');
  if (row.ownerId !== null) throw new AppError(409, 'ALREADY_CLAIMED', 'Device already claimed');

  await db
    .update(device)
    .set({ ownerId, status: 'CLAIMED', updatedAt: new Date() })
    .where(eq(device.id, row.id));
  const updated = await readDeviceOrFail(row.id);
  return toSummmary(updated);
}

export async function claimAccountless(
  slug: string,
  claimCode: unknown,
): Promise<{ id: string; slug: string; name: string }> {
  if (!isValidSlug(slug)) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  const { claimCode: code } = setupClaimCodeSchema.parse({ claimCode });
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.slug, slug), eq(device.claimCodeHash, hashClaimCode(code))),
  });
  if (!row) throw new AppError(404, 'INVALID_SETUP_CODE', 'Invalid claim code for this device');
  // Accountless setup must not overwrite a device that is already live or published.
  if (row.status === 'DISABLED')
    throw new AppError(409, 'DEVICE_DISABLED', 'This device is disabled and cannot be set up');
  if (row.status === 'PUBLISHED' || row.status === 'UNPUBLISHED') {
    throw new AppError(409, 'ALREADY_SET_UP', 'This device is already set up and configured');
  }

  await db
    .update(device)
    .set({ status: 'CLAIMED', updatedAt: new Date() })
    .where(eq(device.id, row.id));
  return { id: row.id, slug: row.slug, name: row.name };
}

async function hasActiveDestination(deviceId: string): Promise<boolean> {
  const rows = await getDb().query.destination.findMany({
    where: and(eq(destination.deviceId, deviceId), eq(destination.active, true)),
  });
  return rows.length > 0;
}

export async function publish(id: string, ownerId: number): Promise<DeviceSummary> {
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), eq(device.ownerId, ownerId)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  if (row.status === 'DISABLED')
    throw new AppError(409, 'DEVICE_DISABLED', 'Disabled devices cannot be published');
  if (!(await hasActiveDestination(id))) {
    throw new AppError(
      409,
      'NO_DESTINATIONS',
      'Add at least one active destination before publishing',
    );
  }
  await db
    .update(device)
    .set({ status: 'PUBLISHED', updatedAt: new Date() })
    .where(eq(device.id, id));
  return toSummmary(await readDeviceOrFail(id));
}

export async function unpublish(id: string, ownerId: number): Promise<DeviceSummary> {
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), eq(device.ownerId, ownerId)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  if (row.status !== 'PUBLISHED') return toSummmary(row);
  await db
    .update(device)
    .set({ status: 'UNPUBLISHED', updatedAt: new Date() })
    .where(eq(device.id, id));
  return toSummmary(await readDeviceOrFail(id));
}

export async function transfer(
  id: string,
  fromOwnerId: number,
  input: unknown,
): Promise<DeviceSummary> {
  const { toMerchantId } = transferDeviceSchema.parse(input);
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), eq(device.ownerId, fromOwnerId)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  const target = await db.query.merchantProfile.findFirst({
    where: eq(merchantProfile.id, toMerchantId),
  });
  if (!target) throw new AppError(404, 'MERCHANT_NOT_FOUND', 'Target merchant not found');

  await db
    .update(device)
    .set({ ownerId: toMerchantId, updatedAt: new Date() })
    .where(eq(device.id, id));
  return toSummmary(await readDeviceOrFail(id));
}

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

export async function adminCreate(input: unknown): Promise<CreateDeviceResult> {
  const { name, organizationId } = createDeviceSchema.parse(input);
  const db = getDb();
  const now = new Date();
  const id = randomUUID();
  const slug = await ensureUniqueSlug();
  const claimCode = generateClaimCode();

  if (organizationId) {
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, organizationId),
    });
    if (!org) throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Reseller organization not found');
  }

  await db.insert(device).values({
    id,
    slug,
    name,
    status: 'UNCLAIMED',
    organizationId: organizationId ?? null,
    claimCodeHash: hashClaimCode(claimCode),
    createdAt: now,
    updatedAt: now,
  });
  const row = await readDeviceOrFail(id);
  return { device: toSummmary(row), claimCode };
}

export async function adminList(): Promise<DeviceSummary[]> {
  const rows = await getDb().query.device.findMany({
    orderBy: desc(device.createdAt),
  });
  return rows.map(toSummmary);
}

export async function adminSetDisabled(id: string, disabled: boolean): Promise<DeviceSummary> {
  const db = getDb();
  const row = await findDevice(id);
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  const status: DeviceStatus = disabled ? 'DISABLED' : 'CLAIMED';
  await db.update(device).set({ status, updatedAt: new Date() }).where(eq(device.id, id));
  return toSummmary(await readDeviceOrFail(id));
}

export async function adminDeviceScanCount(id: string): Promise<number> {
  const rows = await getDb().query.scanEvent.findMany({
    where: eq(scanEvent.deviceId, id),
    columns: { id: true },
  });
  return rows.length;
}

export function isPublishable(status: DeviceStatus): boolean {
  return status === 'CLAIMED' || status === 'UNPUBLISHED';
}

// ---------------------------------------------------------------------------
// Reset scopes (FR-028) — claim code is rotated on every reset
// ---------------------------------------------------------------------------

async function clearDeviceConfig(id: string, now: Date): Promise<void> {
  const db = getDb();
  await db.delete(destination).where(eq(destination.deviceId, id));
  await db
    .update(device)
    .set({ memberId: null, boundUserId: null, updatedAt: now })
    .where(eq(device.id, id));
}

/** Owner reset: keeps organizationId, clears config, rotates the claim code (FR-028). */
export async function ownerReset(
  id: string,
  organizationId: string,
): Promise<{
  device: DeviceSummary;
  claimCode: string;
}> {
  const db = getDb();
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, id), eq(device.organizationId, organizationId)),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');

  const now = new Date();
  const claimCode = generateClaimCode();
  await clearDeviceConfig(id, now);
  await db
    .update(device)
    .set({ status: 'CLAIMED', claimCodeHash: hashClaimCode(claimCode), updatedAt: now })
    .where(eq(device.id, id));
  return { device: toSummmary(await readDeviceOrFail(id)), claimCode };
}

/** Admin reset: clears organization binding too, back to unclaimed (FR-028). */
export async function adminReset(id: string): Promise<{
  device: DeviceSummary;
  claimCode: string;
}> {
  const db = getDb();
  const row = await findDevice(id);
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');

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

// Re-export schema types used by callers
export type {
  ClaimDeviceInput,
  CreateDeviceInput,
  SetupClaimCodeInput,
  TransferDeviceInput,
} from '@/domains/device/schemas';
export { CLAIM_CODE_PATTERN, DEVICE_STATUS, isValidSlug };
