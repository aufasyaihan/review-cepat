'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { claimDeviceSchema } from '@/domains/device/schemas';
import type { DeviceSummary } from '@/domains/device/types';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import {
  claimWithCode,
  type RegisterWithClaimCodeInput,
  registerWithClaimCode,
} from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireApiUser } from '@/lib/session';

const signUpWithCodeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  claimCode: claimDeviceSchema.shape.claimCode,
});

export async function signUpWithClaimCodeAction(
  input: RegisterWithClaimCodeInput,
): Promise<ActionResult<{ role: 'MERCHANT' }>> {
  const parsed = signUpWithCodeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid registration details');
  }
  try {
    const result = await registerWithClaimCode(parsed.data);
    revalidatePath('/dashboard');
    revalidatePath('/devices');
    return ok({ role: result.role });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not register with this claim code');
  }
}

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
