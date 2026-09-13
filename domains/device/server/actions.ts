'use server';

import { revalidatePath } from 'next/cache';
import {
  claimDeviceSchema,
  createDeviceSchema,
  transferDeviceSchema,
} from '@/domains/device/schemas';
import type { CreateDeviceResult, DeviceSummary } from '@/domains/device/types';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { requireApiMerchant, requireApiUser } from '@/lib/session';
import { adminCreate, adminSetDisabled, claim, publish, transfer, unpublish } from './service';

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Operation failed';
}

export async function claimDeviceAction(claimCode: string): Promise<ActionResult<DeviceSummary>> {
  try {
    const { merchantId } = await requireApiMerchant();
    const parsed = claimDeviceSchema.safeParse({ claimCode });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid claim code');
    const device = await claim(merchantId, parsed.data);
    revalidatePath('/devices');
    revalidatePath(`/devices/${device.id}`);
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function publishDeviceAction(id: string): Promise<ActionResult<DeviceSummary>> {
  try {
    const { merchantId } = await requireApiMerchant();
    const device = await publish(id, merchantId);
    revalidatePath('/devices');
    revalidatePath(`/devices/${id}`);
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function unpublishDeviceAction(id: string): Promise<ActionResult<DeviceSummary>> {
  try {
    const { merchantId } = await requireApiMerchant();
    const device = await unpublish(id, merchantId);
    revalidatePath('/devices');
    revalidatePath(`/devices/${id}`);
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function transferDeviceAction(
  id: string,
  toMerchantId: number,
): Promise<ActionResult<DeviceSummary>> {
  try {
    const { merchantId } = await requireApiMerchant();
    const parsed = transferDeviceSchema.safeParse({ toMerchantId });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid transfer target');
    const device = await transfer(id, merchantId, parsed.data);
    revalidatePath('/devices');
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function createDeviceAction(name: string): Promise<ActionResult<CreateDeviceResult>> {
  try {
    await requireApiUser(['ADMIN']);
    const parsed = createDeviceSchema.safeParse({ name });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid device name');
    const result = await adminCreate(parsed.data);
    revalidatePath('/admin/devices');
    return ok(result);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function setDeviceDisabledAction(
  id: string,
  disabled: boolean,
): Promise<ActionResult<DeviceSummary>> {
  try {
    await requireApiUser(['ADMIN']);
    const device = await adminSetDisabled(id, disabled);
    revalidatePath('/admin/devices');
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}
