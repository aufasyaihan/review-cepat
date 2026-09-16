'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { assignDevice, unassignDevice } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { auth } from '@/lib/auth';
import { requireApiPermission, type SessionUser } from '@/lib/session';

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['owner', 'member'], { message: 'Role must be owner or member' }),
  organizationId: z.string().trim().min(1).optional(),
});

/**
 * Resolves the organization a member-management action should operate on.
 * MERCHANT owners always act on their own org (any client-supplied
 * organizationId is ignored — they can't spoof another org). ADMIN has no
 * membership of their own, so they must supply one explicitly; it's
 * re-validated by the org-scoped assertions in service.ts / Better Auth's
 * own org lookup, never trusted blindly.
 */
async function resolveOrganizationId(
  user: SessionUser,
  organizationId?: string,
): Promise<string | null> {
  if (user.role === 'ADMIN') return organizationId ?? null;
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) return null;
  return membership.organizationId;
}

/** Owner or admin invites a sub-merchant to an organization (FR-022). */
export async function inviteMemberAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid invitation');

  const user = await requireApiPermission('/api/member/invite');
  const organizationId = await resolveOrganizationId(user, parsed.data.organizationId);
  if (!organizationId) {
    return fail(
      user.role === 'ADMIN'
        ? 'Select an organization to invite into'
        : 'Only an organization owner can invite members',
    );
  }

  try {
    const orgApi = auth.api as unknown as {
      inviteMember: (opts: {
        body: { email: string; role: string; organizationId: string };
      }) => Promise<unknown>;
    };
    await orgApi.inviteMember({
      body: { email: parsed.data.email, role: parsed.data.role, organizationId },
    });
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not send invitation');
  }
}

/** Owner or admin assigns a device to a sub-merchant member (FR-027). */
export async function assignDeviceAction(
  deviceId: string,
  memberId: string,
  organizationId?: string,
): Promise<ActionResult<void>> {
  const user = await requireApiPermission('/api/member/assign');
  const orgId = await resolveOrganizationId(user, organizationId);
  if (!orgId) {
    return fail(
      user.role === 'ADMIN'
        ? 'Select an organization to assign devices in'
        : 'Only an organization owner can assign devices',
    );
  }

  try {
    await assignDevice(deviceId, memberId, orgId);
    revalidatePath('/devices');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not assign device');
  }
}

export async function unassignDeviceAction(
  deviceId: string,
  organizationId?: string,
): Promise<ActionResult<void>> {
  const user = await requireApiPermission('/api/member/unassign');
  const orgId = await resolveOrganizationId(user, organizationId);
  if (!orgId) {
    return fail(
      user.role === 'ADMIN'
        ? 'Select an organization to unassign devices in'
        : 'Only an organization owner can unassign devices',
    );
  }

  try {
    await unassignDevice(deviceId, orgId);
    revalidatePath('/devices');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not unassign device');
  }
}
