'use server';

import { revalidatePath } from 'next/cache';
import {
  claimDeviceSchema,
  createDeviceSchema,
  renameDeviceSchema,
  transferDeviceSchema,
} from '@/domains/device/schemas';
import type { CreateDeviceResult, DeviceSummary } from '@/domains/device/types';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { claimWithCode } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import {
  requireApiMembership,
  requireApiMerchant,
  requireApiPermission,
  requireApiUser,
} from '@/lib/session';
import {
  adminCreate,
  adminRenameDevice,
  adminReset,
  adminSetDisabled,
  deleteDevice,
  ownerReset,
  publishVisible,
  renameVisibleDevice,
  transfer,
  unpublishVisible,
} from './service';

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Operation failed';
}

export async function claimDeviceAction(claimCode: string): Promise<ActionResult<DeviceSummary>> {
  try {
    const user = await requireApiPermission('/api/device/claim');
    const membership = await getActiveOrganization(user.id);
    if (!membership) return fail('Not part of an organization yet');

    const parsed = claimDeviceSchema.safeParse({ claimCode });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid claim code');
    const device = await claimWithCode(user.id, membership, parsed.data.claimCode);
    revalidatePath('/devices');
    revalidatePath(`/devices/${device.id}`);
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function publishDeviceAction(id: string): Promise<ActionResult<DeviceSummary>> {
  try {
    await requireApiPermission('/api/device/publish');
    const membership = await requireApiMembership();
    const device = await publishVisible(id, membership);
    revalidatePath('/devices');
    revalidatePath(`/devices/${id}`);
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function unpublishDeviceAction(id: string): Promise<ActionResult<DeviceSummary>> {
  try {
    await requireApiPermission('/api/device/unpublish');
    const membership = await requireApiMembership();
    const device = await unpublishVisible(id, membership);
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
    await requireApiPermission('/api/device/transfer');
    const parsed = transferDeviceSchema.safeParse({ toMerchantId });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid transfer target');
    const device = await transfer(id, merchantId, parsed.data);
    revalidatePath('/devices');
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function createDeviceAction(
  name: string,
  organizationId?: string,
): Promise<ActionResult<CreateDeviceResult>> {
  try {
    await requireApiUser(['ADMIN']);
    await requireApiPermission('/api/device/create');
    const parsed = createDeviceSchema.safeParse({
      name,
      organizationId: organizationId ?? undefined,
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid device name');
    const result = await adminCreate(parsed.data);
    revalidatePath('/devices');
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
    await requireApiPermission('/api/device/disable');
    const device = await adminSetDisabled(id, disabled);
    revalidatePath('/devices');
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

export async function deleteDeviceAction(id: string): Promise<ActionResult<DeviceSummary>> {
  try {
    await requireApiUser(['ADMIN']);
    await requireApiPermission('/api/device/delete');
    const device = await deleteDevice(id);
    revalidatePath('/devices');
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

/** Rename a device in place: admin scope (any device) or owner scope. FR-045. */
export async function renameDeviceAction(
  id: string,
  name: string,
  scope: 'owner' | 'admin' = 'admin',
): Promise<ActionResult<DeviceSummary>> {
  try {
    await requireApiPermission('/api/device/update');
    const parsed = renameDeviceSchema.safeParse({ name });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid device name');

    if (scope === 'admin') {
      await requireApiUser(['ADMIN']);
      const device = await adminRenameDevice(id, parsed.data.name);
      revalidatePath('/devices');
      revalidatePath(`/devices/${id}`);
      return ok(device);
    }

    const membership = await requireApiMembership();
    const device = await renameVisibleDevice(id, membership, parsed.data.name);
    revalidatePath('/devices');
    revalidatePath(`/devices/${id}`);
    return ok(device);
  } catch (err) {
    return fail(toMessage(err));
  }
}

/** Reset a device: owner scope (keeps org) or admin scope (clears org). FR-028. */
export async function resetDeviceAction(
  id: string,
  scope: 'owner' | 'admin',
): Promise<ActionResult<{ device: DeviceSummary; claimCode: string }>> {
  try {
    await requireApiPermission('/api/device/reset');
    if (scope === 'admin') {
      await requireApiUser(['ADMIN']);
      const result = await adminReset(id);
      revalidatePath('/devices');
      return ok(result);
    }

    const user = await requireApiUser(['MERCHANT']);
    const membership = await getActiveOrganization(user.id);
    if (!membership || !isOwner(membership)) {
      return fail('Only an organization owner can reset this device');
    }
    const result = await ownerReset(id, membership.organizationId);
    revalidatePath('/devices');
    revalidatePath(`/devices/${id}`);
    return ok(result);
  } catch (err) {
    return fail(toMessage(err));
  }
}
