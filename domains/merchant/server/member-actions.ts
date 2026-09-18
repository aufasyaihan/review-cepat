'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import {
  assignDevice,
  createUser,
  deactivateUser,
  unassignDevice,
  updateUser,
} from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { auth } from '@/lib/auth';
import { requireApiPermission, type SessionUser } from '@/lib/session';

const removeMemberSchema = z.object({
  memberId: z.string().trim().min(1, 'Member ID is required'),
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

/** Owner or admin removes a member from an organization (FR-022). */
export async function removeMemberAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid member');

  const user = await requireApiPermission('/api/member/remove');
  const orgId = await resolveOrganizationId(user, parsed.data.organizationId);
  if (!orgId) {
    return fail(
      user.role === 'ADMIN'
        ? 'Select an organization'
        : 'Only an organization owner can remove members',
    );
  }

  try {
    const authApi = auth.api as unknown as {
      removeMember: (opts: {
        body: { organizationId: string; memberIdOrEmail: string };
      }) => Promise<unknown>;
    };
    await authApi.removeMember({
      body: { organizationId: orgId, memberIdOrEmail: parsed.data.memberId },
    });
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not remove member');
  }
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organizationId: z.string().trim().min(1, 'Select a merchant'),
  role: z.enum(['owner', 'member']),
});

/** Admin creates a platform account and joins it to an organization (FR-052). */
export async function createUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid user');

  const user = await requireApiPermission('/api/members');
  if (user.role !== 'ADMIN') return fail('Only admins can add users');

  try {
    const created = await createUser(parsed.data);
    revalidatePath('/user-management');
    return ok({ id: created.id });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not add user');
  }
}

const updateUserSchema = z.object({
  memberId: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Name is required').optional(),
  email: z.email('Enter a valid email').optional(),
  role: z.enum(['owner', 'member']).optional(),
  organizationId: z.string().trim().min(1).optional(),
});

/** Admin edits a user, including moving between merchants (FR-053). */
export async function updateUserAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid user');

  const user = await requireApiPermission('/api/members/:memberId');
  if (user.role !== 'ADMIN') return fail('Only admins can edit users');

  try {
    await updateUser(parsed.data);
    revalidatePath('/user-management');
    revalidatePath('/devices');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not update user');
  }
}

/** Admin deletes a user (removes membership + deactivates the account) (FR-052). */
export async function deleteUserAction(memberId: string): Promise<ActionResult<void>> {
  const user = await requireApiPermission('/api/members/:memberId');
  if (user.role !== 'ADMIN') return fail('Only admins can delete users');

  try {
    await deactivateUser(memberId);
    revalidatePath('/user-management');
    revalidatePath('/devices');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not delete user');
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
