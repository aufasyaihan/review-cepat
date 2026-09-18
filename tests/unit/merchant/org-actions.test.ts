import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/session', () => ({
  requireApiPermission: vi.fn(),
}));
vi.mock('@/domains/merchant/server/service', () => ({
  createOrganizationShell: vi.fn(),
  updateOrganizationName: vi.fn(),
  deleteOrganizationAction: vi.fn(),
  setOrgOwner: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import {
  createOrganizationAction,
  deleteMerchantAction,
  updateOrganizationAction,
} from '@/domains/merchant/server/org-actions';
import {
  createOrganizationShell,
  deleteOrganizationAction,
  setOrgOwner,
  updateOrganizationName,
} from '@/domains/merchant/server/service';
import { requireApiPermission } from '@/lib/session';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOrganizationAction', () => {
  it('fails for non-admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await createOrganizationAction({ name: 'Acme' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('admin');
    expect(createOrganizationShell).not.toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    const result = await createOrganizationAction({ name: '' });
    expect(result.ok).toBe(false);
    expect(createOrganizationShell).not.toHaveBeenCalled();
  });

  it('creates only the org shell (no owner) and revalidates', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(createOrganizationShell).mockResolvedValue({
      id: 'org-new',
      name: 'Acme',
      slug: 'acme',
      deviceCount: 0,
    });
    const result = await createOrganizationAction({ name: 'Acme' });
    expect(result.ok).toBe(true);
    expect(createOrganizationShell).toHaveBeenCalledWith('Acme');
    expect(revalidatePath).toHaveBeenCalledWith('/merchants');
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
    if (result.ok) expect(result.data).toEqual({ id: 'org-new' });
  });

  it('returns error on failure', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(createOrganizationShell).mockRejectedValue(new Error('db error'));
    const result = await createOrganizationAction({ name: 'Acme' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('db error');
  });
});

describe('updateOrganizationAction', () => {
  it('fails for non-admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await updateOrganizationAction({ organizationId: 'org-1', name: 'New Name' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('admin');
  });

  it('rejects invalid input', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    const result = await updateOrganizationAction({ organizationId: 'org-1', name: '' });
    expect(result.ok).toBe(false);
  });

  it('updates and revalidates for admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(updateOrganizationName).mockResolvedValue(undefined);
    const result = await updateOrganizationAction({ organizationId: 'org-1', name: 'New Name' });
    expect(result.ok).toBe(true);
    expect(updateOrganizationName).toHaveBeenCalledWith('org-1', 'New Name');
    expect(revalidatePath).toHaveBeenCalledWith('/merchants');
  });

  it('returns error on failure', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(updateOrganizationName).mockRejectedValue(new Error('db error'));
    const result = await updateOrganizationAction({ organizationId: 'org-1', name: 'New Name' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('db error');
  });

  it('also reassigns the owner when ownerId is supplied', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(updateOrganizationName).mockResolvedValue(undefined);
    vi.mocked(setOrgOwner).mockResolvedValue(undefined as never);
    const result = await updateOrganizationAction({
      organizationId: 'org-1',
      name: 'New Name',
      ownerId: 'user-9',
    });
    expect(result.ok).toBe(true);
    expect(setOrgOwner).toHaveBeenCalledWith('org-1', 'user-9');
  });

  it('does not reassign the owner when ownerId is omitted', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(updateOrganizationName).mockResolvedValue(undefined);
    const result = await updateOrganizationAction({ organizationId: 'org-1', name: 'New Name' });
    expect(result.ok).toBe(true);
    expect(setOrgOwner).not.toHaveBeenCalled();
  });
});

describe('deleteMerchantAction', () => {
  it('fails for non-admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await deleteMerchantAction('org-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('admin');
  });

  it('deletes and revalidates for admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(deleteOrganizationAction).mockResolvedValue(undefined);
    const result = await deleteMerchantAction('org-1');
    expect(result.ok).toBe(true);
    expect(deleteOrganizationAction).toHaveBeenCalledWith('org-1');
    expect(revalidatePath).toHaveBeenCalledWith('/merchants');
  });

  it('returns error on failure', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(deleteOrganizationAction).mockRejectedValue(new Error('not found'));
    const result = await deleteMerchantAction('org-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });
});
