'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { device } from '@/db/schema';
import { adminReset, ownerForgetDevice } from '@/domains/device/server/service';
import {
  getActiveOrganization,
  isOwner,
  type Membership,
} from '@/domains/merchant/server/permissions';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireRole } from '@/lib/session';
import { resolveSetupToken } from '@/lib/setup-token';

async function requireOwnerMembership(): Promise<{
  membership: Membership;
  userId: string;
}> {
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    throw new Error('Only an organization owner can make this choice');
  }
  return { membership, userId: user.id };
}

/**
 * Both /option actions require the same signed setup token that gates the
 * page itself: it proves the caller validated this specific device's claim
 * code, not just that they own some organization. Without this check either
 * action would be directly callable (as a Server Action) for any org-less
 * device id, bypassing the claim-code proof entirely.
 */
function requireClaimProof(deviceId: string, token: string): void {
  if (resolveSetupToken(token) !== deviceId) {
    throw new Error('This device link has expired — please scan the device again');
  }
}

/** /option: claim an org-less device into the caller's own organization. */
export async function claimForSelfAction(
  deviceId: string,
  token: string,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    requireClaimProof(deviceId, token);
    const { membership, userId } = await requireOwnerMembership();
    const db = getDb();
    const existing = await db.query.device.findFirst({ where: eq(device.id, deviceId) });
    if (!existing || existing.organizationId !== null) {
      return fail('This device is not available to claim');
    }
    await db
      .update(device)
      .set({
        organizationId: membership.organizationId,
        memberId: membership.id,
        boundUserId: userId,
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
  token: string,
): Promise<ActionResult<{ claimCode: string }>> {
  try {
    requireClaimProof(deviceId, token);
    const { membership } = await requireOwnerMembership();
    const db = getDb();
    const existing = await db.query.device.findFirst({ where: eq(device.id, deviceId) });
    if (
      !existing ||
      (existing.organizationId !== null && existing.organizationId !== membership.organizationId)
    ) {
      return fail('This device is not available to resell');
    }
    const result =
      existing.organizationId === null
        ? await adminReset(deviceId)
        : await ownerForgetDevice(deviceId, membership.organizationId);
    return ok({ claimCode: result.claimCode });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not reset this device');
  }
}
