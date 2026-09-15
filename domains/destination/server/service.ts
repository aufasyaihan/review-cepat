import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { destination, device, place } from '@/db/schema';
import { deriveReviewUrl } from '@/domains/destination/constants';
import { type DestinationInput, setDestinationsSchema } from '@/domains/destination/schemas';
import type { DestinationDto } from '@/domains/device/types';
import type { Membership } from '@/domains/merchant/server/permissions';
import { AppError } from '@/lib/errors';

function toDto(row: {
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

async function assertVisible(deviceId: string, membership: Membership): Promise<void> {
  const row = await getDb().query.device.findFirst({
    where: and(
      eq(device.id, deviceId),
      eq(device.organizationId, membership.organizationId),
      membership.role === 'member' ? eq(device.memberId, membership.id) : undefined,
    ),
  });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
}

/** Resolves a Google review destination to a stored place id + derived review URL. */
async function resolvePlace(
  input: DestinationInput,
  now: Date,
): Promise<{ placeId: string; url: string } | null> {
  if (input.type !== 'GOOGLE_REVIEW' || !input.placeId) return null;
  const db = getDb();
  let row = await db.query.place.findFirst({
    where: eq(place.googlePlaceId, input.placeId),
  });
  if (!row) {
    await db.insert(place).values({
      id: randomUUID(),
      googlePlaceId: input.placeId,
      name: input.label ?? `Place ${input.placeId}`,
      createdAt: now,
      updatedAt: now,
    });
    row = await db.query.place.findFirst({
      where: eq(place.googlePlaceId, input.placeId),
    });
  }
  if (!row) throw new AppError(500, 'PLACE_CREATE_FAILED', 'Failed to store the place');
  return { placeId: row.id, url: deriveReviewUrl(input.placeId) };
}

/** Atomically replaces a device's destination list (single or multi-link). */
export async function setForDevice(
  deviceId: string,
  membership: Membership,
  input: unknown,
): Promise<DestinationDto[]> {
  await assertVisible(deviceId, membership);
  return persistDestinations(deviceId, input);
}

/**
 * Accountless variant used by /{slug}/setup/redirect (FR-004): no owner/account
 * is required, but the device must exist and not be disabled, and a valid setup
 * token must have been verified by the caller action.
 */
export async function setForDeviceSetup(
  deviceId: string,
  input: unknown,
): Promise<DestinationDto[]> {
  const db = getDb();
  const row = await db.query.device.findFirst({ where: eq(device.id, deviceId) });
  if (!row) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  if (row.status === 'DISABLED')
    throw new AppError(409, 'DEVICE_DISABLED', 'Disabled devices cannot be configured');

  const result = await persistDestinations(deviceId, input);
  if (result.length > 0) {
    await db
      .update(device)
      .set({ status: 'CLAIMED', updatedAt: new Date() })
      .where(eq(device.id, deviceId));
  }
  return result;
}

async function persistDestinations(deviceId: string, input: unknown): Promise<DestinationDto[]> {
  const { destinations } = setDestinationsSchema.parse(input);
  const db = getDb();
  const now = new Date();

  const resolved = await Promise.all(
    destinations.map(async (d) => {
      const placeInfo = await resolvePlace(d, now);
      return {
        id: randomUUID(),
        deviceId,
        type: d.type,
        label: d.label ?? null,
        url: placeInfo?.url ?? d.url ?? null,
        placeId: placeInfo?.placeId ?? d.placeId ?? null,
        position: d.position,
        active: d.active,
        createdAt: now,
        updatedAt: now,
      };
    }),
  );

  await db.delete(destination).where(eq(destination.deviceId, deviceId));
  await db.insert(destination).values(resolved);

  const rows = await db.query.destination.findMany({
    where: eq(destination.deviceId, deviceId),
    orderBy: asc(destination.position),
  });
  return rows.map(toDto);
}

export async function listForDevice(deviceId: string): Promise<DestinationDto[]> {
  const rows = await getDb().query.destination.findMany({
    where: eq(destination.deviceId, deviceId),
    orderBy: asc(destination.position),
  });
  return rows.map(toDto);
}

// ---------------------------------------------------------------------------
// Google Places search (server-side only; API key never reaches the client)
// ---------------------------------------------------------------------------

export type PlaceSearchResult = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string | null;
  website: string | null;
};

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !query.trim()) return [];
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new AppError(502, 'PLACES_ERROR', 'Places lookup failed');
  const data = (await res.json()) as {
    results?: Array<{
      place_id?: string;
      name?: string;
      formatted_address?: string;
      website?: string;
    }>;
  };
  return (data.results ?? [])
    .filter((r) => r.place_id)
    .map((r) => ({
      googlePlaceId: r.place_id as string,
      name: r.name ?? '',
      formattedAddress: r.formatted_address ?? null,
      website: r.website ?? null,
    }))
    .slice(0, 20);
}

export { deriveReviewUrl };
