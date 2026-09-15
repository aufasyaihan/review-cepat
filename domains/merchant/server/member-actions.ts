'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { assignDevice, unassignDevice } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { auth } from '@/lib/auth';
import { requireApiPermission } from '@/lib/session';

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['owner', 'member'], { message: 'Role must be owner or member' }),
});

async function requireOwnerMembership(path: string) {
  const user = await requireApiPermission(path);
  const membership = await getActiveOrganization(user.id);
  if (!membership) return null;
  if (!isOwner(membership)) return null;
  return membership;
}

/** Owner invites a sub-merchant to the organization (FR-022). */
export async function inviteMemberAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid invitation');
  const membership = await requireOwnerMembership('/api/member/invite');
  if (!membership) return fail('Only an organization owner can invite members');

  try {
    const orgApi = auth.api as unknown as {
      inviteMember: (opts: {
        body: { email: string; role: string; organizationId: string };
      }) => Promise<unknown>;
    };
    await orgApi.inviteMember({
      body: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: membership.organizationId,
      },
    });
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not send invitation');
  }
}

/** Owner assigns a device to a sub-merchant member (FR-027). */
export async function assignDeviceAction(
  deviceId: string,
  memberId: string,
): Promise<ActionResult<void>> {
  const membership = await requireOwnerMembership('/api/member/assign');
  if (!membership) return fail('Only an organization owner can assign devices');

  try {
    await assignDevice(deviceId, memberId, membership.organizationId);
    revalidatePath('/devices');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not assign device');
  }
}

export async function unassignDeviceAction(deviceId: string): Promise<ActionResult<void>> {
  const membership = await requireOwnerMembership('/api/member/unassign');
  if (!membership) return fail('Only an organization owner can unassign devices');

  try {
    await unassignDevice(deviceId, membership.organizationId);
    revalidatePath('/devices');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not unassign device');
  }
}
