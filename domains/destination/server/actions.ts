'use server';

import { revalidatePath } from 'next/cache';
import type { DestinationDto } from '@/domains/device/types';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireApiMerchant } from '@/lib/session';
import { setForDevice } from './service';

export async function setDestinationsAction(
  deviceId: string,
  input: unknown,
): Promise<ActionResult<DestinationDto[]>> {
  try {
    const { merchantId } = await requireApiMerchant();
    const destinations = await setForDevice(deviceId, merchantId, input);
    revalidatePath('/devices');
    revalidatePath(`/devices/${deviceId}`);
    return ok(destinations);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save destinations');
  }
}
