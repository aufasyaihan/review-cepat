'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireApiPermission } from '@/lib/session';
import {
  createOrganizationShell,
  deleteOrganizationAction,
  setOrgOwner,
  updateOrganizationName,
} from './service';

export async function createOrganizationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({ name: z.string().min(1, 'Name is required') });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid');

  const user = await requireApiPermission('/api/organizations');
  if (user.role !== 'ADMIN') return fail('Only admins can create merchants');

  try {
    const org = await createOrganizationShell(parsed.data.name);
    revalidatePath('/merchants');
    revalidatePath('/user-management');
    return ok({ id: org.id });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not create merchant');
  }
}

export async function updateOrganizationAction(input: unknown): Promise<ActionResult<void>> {
  const schema = z.object({
    organizationId: z.string().min(1),
    name: z.string().min(1, 'Name is required'),
    ownerId: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid');

  const user = await requireApiPermission('/api/organizations/:id');
  if (user.role !== 'ADMIN') return fail('Only admins can edit merchants');

  try {
    await updateOrganizationName(parsed.data.organizationId, parsed.data.name);
    if (parsed.data.ownerId) {
      await setOrgOwner(parsed.data.organizationId, parsed.data.ownerId);
    }
    revalidatePath('/merchants');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not update merchant');
  }
}

export async function deleteMerchantAction(organizationId: string): Promise<ActionResult<void>> {
  const user = await requireApiPermission('/api/organizations/:id');
  if (user.role !== 'ADMIN') return fail('Only admins can delete merchants');

  try {
    await deleteOrganizationAction(organizationId);
    revalidatePath('/merchants');
    revalidatePath('/user-management');
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not delete merchant');
  }
}
