import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  orgFindFirst: vi.fn().mockResolvedValue(null),
  userFindFirst: vi.fn().mockResolvedValue(null),
  memberFindFirst: vi.fn().mockResolvedValue(null),
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  insertValues: vi.fn().mockResolvedValue(undefined),
  deleteWhere: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db', () => ({
  getDb: () => ({
    query: {
      organization: { findFirst: dbMocks.orgFindFirst },
      user: { findFirst: dbMocks.userFindFirst },
      member: { findFirst: dbMocks.memberFindFirst },
    },
    update: () => ({
      set: (values: unknown) => {
        dbMocks.updateSet(values);
        return { where: dbMocks.updateWhere };
      },
    }),
    insert: () => ({ values: dbMocks.insertValues }),
    delete: () => ({ where: dbMocks.deleteWhere }),
  }),
}));
vi.mock('@/lib/codes', () => ({
  hashClaimCode: vi.fn(),
  randomSlug: vi.fn().mockReturnValue('abcd'),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { signUpEmail: vi.fn() } } }));

import {
  createOrganizationShell,
  deleteOrganizationAction,
  setOrgOwner,
  updateOrganizationName,
} from '@/domains/merchant/server/service';

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.orgFindFirst.mockResolvedValue(null);
  dbMocks.userFindFirst.mockResolvedValue(null);
  dbMocks.memberFindFirst.mockResolvedValue(null);
});

describe('createOrganizationShell (FR-054: business name only, NO owner)', () => {
  it('inserts the org shell with a slugified unique slug and zero device count', async () => {
    dbMocks.orgFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'org-new',
      name: 'Acme',
      slug: 'acme',
    });

    const result = await createOrganizationShell('  Acme  ');

    expect(result).toEqual({ id: 'org-new', name: 'Acme', slug: 'acme', deviceCount: 0 });
    expect(dbMocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme', slug: 'acme' }),
    );
  });

  it('falls back to a "merchant" slug for symbols-only names', async () => {
    dbMocks.orgFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'org-new',
      name: '!!!',
      slug: 'merchant',
    });

    const result = await createOrganizationShell('!!!');

    expect(result.slug).toBe('merchant');
  });

  it('appends a random suffix on slug collision and retries once', async () => {
    dbMocks.orgFindFirst
      .mockResolvedValueOnce({ id: 'org-x', name: 'Acme Inc', slug: 'acme-inc' }) // collision
      .mockResolvedValueOnce(null) // suffix is free
      .mockResolvedValueOnce({
        id: 'org-new',
        name: 'Acme Inc',
        slug: 'acme-inc-abcd',
      }); // reload

    const result = await createOrganizationShell('Acme Inc');

    expect(result.slug).toBe('acme-inc-abcd');
  });

  it('throws ORG_CREATE_FAILED when the created org cannot be reloaded', async () => {
    dbMocks.orgFindFirst.mockResolvedValue(null);
    await expect(createOrganizationShell('Acme')).rejects.toMatchObject({
      status: 500,
      code: 'ORG_CREATE_FAILED',
    });
  });
});

describe('setOrgOwner (assigns an owner from an existing account)', () => {
  it('rejects when the account does not exist', async () => {
    await expect(setOrgOwner('org-1', 'missing')).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('upgrades an existing member to owner', async () => {
    dbMocks.userFindFirst.mockResolvedValue({ id: 'u1', name: 'Owner', email: 'o@acme.io' });
    dbMocks.memberFindFirst.mockResolvedValue({
      id: 'm1',
      organizationId: 'org-1',
      userId: 'u1',
      role: 'member',
    });

    await expect(setOrgOwner('org-1', 'u1')).resolves.toBeUndefined();

    expect(dbMocks.updateSet).toHaveBeenCalledWith({ role: 'owner' });
    expect(dbMocks.updateWhere).toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  it('is a no-op when the account is already the owner', async () => {
    dbMocks.userFindFirst.mockResolvedValue({ id: 'u1', name: 'Owner', email: 'o@acme.io' });
    dbMocks.memberFindFirst.mockResolvedValue({
      id: 'm1',
      organizationId: 'org-1',
      userId: 'u1',
      role: 'owner',
    });

    await expect(setOrgOwner('org-1', 'u1')).resolves.toBeUndefined();

    expect(dbMocks.updateSet).not.toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  it('inserts a new owner membership when the account has none', async () => {
    dbMocks.userFindFirst.mockResolvedValue({ id: 'u1', name: 'Owner', email: 'o@acme.io' });

    await expect(setOrgOwner('org-1', 'u1')).resolves.toBeUndefined();

    expect(dbMocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'u1', role: 'owner' }),
    );
  });
});

describe('updateOrganizationName', () => {
  it('rejects when the merchant does not exist', async () => {
    await expect(updateOrganizationName('org-1', 'New Name')).rejects.toMatchObject({
      status: 404,
      code: 'ORGANIZATION_NOT_FOUND',
    });
  });

  it('renames the merchant (name trimmed)', async () => {
    dbMocks.orgFindFirst.mockResolvedValue({ id: 'org-1', name: 'Old', slug: 'old' });

    await expect(updateOrganizationName('org-1', '  New Name  ')).resolves.toBeUndefined();

    expect(dbMocks.updateSet).toHaveBeenCalledWith({ name: 'New Name' });
  });
});

describe('deleteOrganizationAction (merchant deletion)', () => {
  it('rejects when the merchant does not exist', async () => {
    await expect(deleteOrganizationAction('org-1')).rejects.toMatchObject({
      status: 404,
      code: 'ORGANIZATION_NOT_FOUND',
    });
  });

  it('deletes the organization row', async () => {
    dbMocks.orgFindFirst.mockResolvedValue({ id: 'org-1', name: 'Acme', slug: 'acme' });

    await expect(deleteOrganizationAction('org-1')).resolves.toBeUndefined();

    expect(dbMocks.deleteWhere).toHaveBeenCalled();
  });
});
