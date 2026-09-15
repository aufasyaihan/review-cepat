import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { device, scanEvent } from '@/db/schema';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { AppError } from '@/lib/errors';

export type AnalyticsOverview = {
  totalScans: number;
  deviceScans: Array<{ deviceId: string; slug: string; name: string; scans: number }>;
  dailyScans: Array<{ day: string; scans: number }>;
};

export type AnalyticsBreakdown = Array<{ value: string; scans: number }>;

const BREAKDOWN_COLUMNS = {
  browser: scanEvent.browser,
  deviceType: scanEvent.deviceType,
  country: scanEvent.country,
  city: scanEvent.city,
  referrer: scanEvent.referrer,
} as const;
export type BreakdownDimension = keyof typeof BREAKDOWN_COLUMNS;

/** Analytics are owner-only (SC-008); the owner sees every device in the org. */
async function requireOwnerMembership(userId: string) {
  const membership = await getActiveOrganization(userId);
  if (membership?.role !== 'owner') {
    throw new AppError(403, 'ANALYTICS_DENIED', 'Only organization owners can view analytics');
  }
  return membership;
}

export async function overview(userId: string): Promise<AnalyticsOverview> {
  const membership = await requireOwnerMembership(userId);
  const db = getDb();
  const owned = await db.query.device.findMany({
    where: eq(device.organizationId, membership.organizationId),
    columns: { id: true, slug: true, name: true },
  });
  const ids = owned.map((d) => d.id);
  if (ids.length === 0) {
    return { totalScans: 0, deviceScans: [], dailyScans: [] };
  }

  const totalRows = await db
    .select({ cnt: count() })
    .from(scanEvent)
    .where(inArray(scanEvent.deviceId, ids));

  const daily = await db
    .select({ day: sql<string>`DATE(created_at)`, cnt: count() })
    .from(scanEvent)
    .where(inArray(scanEvent.deviceId, ids))
    .groupBy(sql`DATE(created_at)`)
    .orderBy(desc(sql`DATE(created_at)`));

  const perDevice = await db
    .select({ deviceId: scanEvent.deviceId, cnt: count() })
    .from(scanEvent)
    .where(inArray(scanEvent.deviceId, ids))
    .groupBy(scanEvent.deviceId);

  const countMap = new Map(perDevice.map((r) => [r.deviceId, Number(r.cnt)]));

  return {
    totalScans: Number(totalRows[0]?.cnt ?? 0),
    deviceScans: owned.map((d) => ({
      deviceId: d.id,
      slug: d.slug,
      name: d.name,
      scans: countMap.get(d.id) ?? 0,
    })),
    dailyScans: daily.map((r) => ({ day: r.day, scans: Number(r.cnt) })),
  };
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
