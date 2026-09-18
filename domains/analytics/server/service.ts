import { and, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { device, organization, scanEvent, user as userTable } from '@/db/schema';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { AppError } from '@/lib/errors';
import type { SessionUser } from '@/lib/session';

export type AnalyticsOverview = {
  totalScans: number;
  deviceScans: Array<{ deviceId: string; slug: string; name: string; scans: number }>;
  dailyScans: Array<{ day: string; scans: number }>;
  merchantCount: number;
  userCount: number;
};

export type AnalyticsBreakdown = Array<{ value: string; scans: number }>;

export type OverviewWindow = { from?: Date; to?: Date };

const BREAKDOWN_COLUMNS = {
  browser: scanEvent.browser,
  deviceType: scanEvent.deviceType,
  country: scanEvent.country,
  city: scanEvent.city,
  referrer: scanEvent.referrer,
} as const;
export type BreakdownDimension = keyof typeof BREAKDOWN_COLUMNS;

/** Org-owner guard shared by all analytics entry points (SC-008). */
async function requireOwnerMembership(userId: string) {
  const membership = await getActiveOrganization(userId);
  if (membership?.role !== 'owner') {
    throw new AppError(403, 'ANALYTICS_DENIED', 'Only organization owners can view analytics');
  }
  return membership;
}

function windowWhere(deviceIds: string[], window: OverviewWindow) {
  const filters = [inArray(scanEvent.deviceId, deviceIds)];
  if (window.from) filters.push(gte(scanEvent.createdAt, window.from));
  if (window.to) filters.push(lte(scanEvent.createdAt, window.to));
  return and(...filters);
}

async function aggregate(
  db: ReturnType<typeof getDb>,
  ids: string[],
  allDevices: Array<{ id: string; slug: string; name: string }>,
  window: OverviewWindow,
  counts?: { merchantCount: number; userCount: number },
): Promise<AnalyticsOverview> {
  if (ids.length === 0) {
    return {
      totalScans: 0,
      deviceScans: [],
      dailyScans: [],
      merchantCount: counts?.merchantCount ?? 0,
      userCount: counts?.userCount ?? 0,
    };
  }

  const where = windowWhere(ids, window);

  const totalRows = await db.select({ cnt: count() }).from(scanEvent).where(where);

  const daily = await db
    .select({ day: sql<string>`DATE(created_at)`, cnt: count() })
    .from(scanEvent)
    .where(where)
    .groupBy(sql`DATE(created_at)`)
    .orderBy(desc(sql`DATE(created_at)`));

  const perDevice = await db
    .select({ deviceId: scanEvent.deviceId, cnt: count() })
    .from(scanEvent)
    .where(where)
    .groupBy(scanEvent.deviceId);

  const countMap = new Map(perDevice.map((r) => [r.deviceId, Number(r.cnt)]));

  return {
    totalScans: Number(totalRows[0]?.cnt ?? 0),
    deviceScans: allDevices.map((d) => ({
      deviceId: d.id,
      slug: d.slug,
      name: d.name,
      scans: countMap.get(d.id) ?? 0,
    })),
    dailyScans: daily.map((r) => ({ day: r.day, scans: Number(r.cnt) })),
    merchantCount: counts?.merchantCount ?? 0,
    userCount: counts?.userCount ?? 0,
  };
}

/** Owner scoped: aggregates only the caller's organization devices (FR-044). */
export async function overview(
  userId: string,
  window: OverviewWindow = {},
): Promise<AnalyticsOverview> {
  const membership = await requireOwnerMembership(userId);
  const db = getDb();
  const owned = await db.query.device.findMany({
    where: eq(device.organizationId, membership.organizationId),
    columns: { id: true, slug: true, name: true },
  });
  return aggregate(
    db,
    owned.map((d) => d.id),
    owned,
    window,
  );
}

/** Admin aggregate across ALL organizations (FR-044). ADMIN-guarded at the
 * service level (defense in depth; the route also guards via requireApiUser). */
export async function adminOverview(
  user: Pick<SessionUser, 'id' | 'role'>,
  window: OverviewWindow = {},
): Promise<AnalyticsOverview> {
  if (user.role !== 'ADMIN') {
    throw new AppError(403, 'ANALYTICS_DENIED', 'Only admins can view analytics');
  }
  const db = getDb();
  const allDevices = (await db.query.device.findMany({
    columns: { id: true, slug: true, name: true },
  })) as Array<{ id: string; slug: string; name: string }>;

  const [{ cnt: merchantCount }] = await db.select({ cnt: count() }).from(organization);
  const [{ cnt: userCount }] = await db.select({ cnt: count() }).from(userTable);

  return aggregate(
    db,
    allDevices.map((d) => d.id),
    allDevices,
    window,
    { merchantCount: Number(merchantCount), userCount: Number(userCount) },
  );
}

export async function breakdown(
  userId: string,
  deviceId: string,
  dimension: BreakdownDimension,
): Promise<AnalyticsBreakdown> {
  const membership = await requireOwnerMembership(userId);
  const db = getDb();
  const owned = await db.query.device.findFirst({
    where: and(eq(device.id, deviceId), eq(device.organizationId, membership.organizationId)),
  });
  if (!owned) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');

  const column = BREAKDOWN_COLUMNS[dimension];
  if (!column) throw new AppError(400, 'BAD_DIMENSION', 'Unsupported breakdown dimension');

  const rows = await db
    .select({ value: column, cnt: count() })
    .from(scanEvent)
    .where(eq(scanEvent.deviceId, deviceId))
    .groupBy(column)
    .orderBy(desc(count()));

  return rows
    .filter((r) => r.value)
    .map((r) => ({ value: r.value as string, scans: Number(r.cnt) }));
}
