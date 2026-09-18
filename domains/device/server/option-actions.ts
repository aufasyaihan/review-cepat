'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { device } from '@/db/schema';
import { ownerForgetDevice } from '@/domains/device/server/service';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireRole } from '@/lib/session';

async function requireOwnerMembership() {
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    throw new Error('Only an organization owner can make this choice');
  }
  return membership;
}

/** /option: claim an org-less device into the caller's own organization. */
export async function claimForSelfAction(
  deviceId: string,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const membership = await requireOwnerMembership();
    const db = getDb();
    await db
      .update(device)
      .set({
        organizationId: membership.organizationId,
        memberId: membership.id,
        status: 'CLAIMED',
        updatedAt: new Date(),
      })
      .where(eq(device.id, deviceId));
    return ok({ redirectUrl: '/dashboard' });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not claim this device');
  }
}

/** /option: release the device back to UNCLAIMED, wiped, with a fresh code. */
export async function resellDeviceAction(
  deviceId: string,
): Promise<ActionResult<{ claimCode: string }>> {
  try {
    const membership = await requireOwnerMembership();
    const result = await ownerForgetDevice(deviceId, membership.organizationId);
    return ok({ claimCode: result.claimCode });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not reset this device');
  }
}
