'use server';

import { setDestinationsSchema } from '@/domains/destination/schemas';
import { getById } from '@/domains/device/server/service';
import type { DestinationDto } from '@/domains/device/types';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { verifySetupToken } from '@/lib/setup-token';
import { setForDeviceSetup } from './service';

/**
 * Public (no auth) step 2 of accountless setup (FR-004). Requires the
 * short-lived setup token issued by setupClaimCodeAction so the destination
 * editor can only be used after proving knowledge of the claim code.
 */
export async function saveSetupDestinationsAction(
  deviceId: string,
  token: string,
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  try {
    if (!verifySetupToken(token, deviceId)) {
      return fail('Setup session expired or invalid — please start again at the device URL.');
    }
    const parsed = setDestinationsSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid destinations');
    }
    await setForDeviceSetup(deviceId, parsed.data);
    const device = await getById(deviceId);
    if (!device) return fail('Device not found');
    return ok({ slug: device.slug });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save destinations');
  }
}

export type { DestinationDto };
