import { randomUUID } from 'node:crypto';

import { getDb } from '@/db';
import { scanEvent } from '@/db/schema';
import { getBySlug } from '@/domains/device/server/service';
import type { DeviceDetail } from '@/domains/device/types';
import type { ScanOutcome, ScanSource } from '@/domains/scan/constants';
import { buildLandingPayload, type LandingPayload, resolveOutcome } from '@/domains/scan/utils';

export type RecordScanInput = {
  deviceId: string;
  destinationId: string | null;
  outcome: ScanOutcome;
  browser: string | null;
  deviceType: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  source: ScanSource;
  userAgent: string | null;
  ipHash: string | null;
};

/** Appends a scan event. Recording happens exactly once, server-side, before the response. */
export async function recordScan(input: RecordScanInput): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(scanEvent)
    .values({
      id: randomUUID(),
      deviceId: input.deviceId,
      destinationId: input.destinationId,
      outcome: input.outcome,
      browser: input.browser,
      deviceType: input.deviceType,
      country: input.country,
      city: input.city,
      referrer: input.referrer?.slice(0, 300) ?? null,
      source: input.source,
      userAgent: input.userAgent?.slice(0, 1000) ?? null,
      ipHash: input.ipHash,
      createdAt: now,
    });
}

export type ResolvedScan = {
  device: DeviceDetail | null;
  outcome: ScanOutcome;
  payload: LandingPayload;
};

/** Resolves a public device by slug for the customer-facing route. */
export async function resolveForSlug(slug: string): Promise<ResolvedScan> {
  const device = await getBySlug(slug);
  return {
    device,
    outcome: resolveOutcome(device),
    payload: buildLandingPayload(device),
  };
}
