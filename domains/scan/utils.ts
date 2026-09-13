import type { DeviceDetail } from '@/domains/device/types';
import type { ScanOutcome } from './constants';

/**
 * Pure resolution of a scan into a customer-facing outcome (contract public-scan.md).
 * Single published destination → immediate redirect; several → landing page;
 * anything else → inactive; unknown device → not found.
 */
export function resolveOutcome(device: DeviceDetail | null): ScanOutcome {
  if (!device) return 'NOT_FOUND';
  if (device.status !== 'PUBLISHED') return 'INACTIVE';
  const active = device.destinations.filter((d) => d.active && d.url);
  if (active.length === 0) return 'INACTIVE';
  if (active.length === 1) return 'REDIRECTED';
  return 'LANDING_SHOWN';
}

export type LandingPayload = {
  slug: string;
  name: string;
  outcome: ScanOutcome;
  links: Array<{ id: string; type: string; label: string | null; url: string }>;
};

export function buildLandingPayload(device: DeviceDetail | null): LandingPayload {
  const outcome = resolveOutcome(device);
  if (!device) return { slug: '', name: '', outcome: 'NOT_FOUND', links: [] };
  const links = device.destinations
    .filter((d) => d.active && d.url)
    .map((d) => ({ id: d.id, type: d.type, label: d.label, url: d.url as string }));
  return { slug: device.slug, name: device.name, outcome, links };
}
