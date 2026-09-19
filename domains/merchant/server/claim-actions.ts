'use server';

import { revalidatePath } from 'next/cache';

import type { DeviceSummary } from '@/domains/device/types';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { claimWithCode } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireApiUser } from '@/lib/session';

export async function claimWithCodeAction(claimCode: string): Promise<ActionResult<DeviceSummary>> {
  try {
    const user = await requireApiUser(['MERCHANT']);
    const membership = await getActiveOrganization(user.id);
    if (!membership) return fail('You are not part of an organization yet');

    const device = await claimWithCode(user.id, membership, claimCode);
    revalidatePath('/devices');
    revalidatePath(`/devices/${device.id}`);
    return ok(device);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not claim this device');
  }
}
