import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('@/db', () => {
  const builder = () => {
    const q = Object.assign(Promise.resolve(state.rows), {
      where: () => q,
      orderBy: () => q,
    });
    return q;
  };
  return {
    getDb: () => ({ select: () => ({ from: () => builder() }) }),
  };
});

vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import {
  can,
  findPermissionForPath,
  getRole,
  listNavForRole,
  roleMatches,
} from '@/domains/auth/server/permissions';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';

const getOrgMock = vi.mocked(getActiveOrganization);

beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
});

describe('roleMatches', () => {
  it('matches an explicit role token', () => {
    expect(roleMatches(['ADMIN'], 'ADMIN', null)).toBe(true);
    expect(roleMatches(['MERCHANT'], 'MERCHANT', 'owner')).toBe(true);
    expect(roleMatches(['MERCHANT'], 'MERCHANT', 'member')).toBe(true);
  });

  it('matches org-scoped MERCHANT tokens only for the right org role', () => {
    expect(roleMatches(['MERCHANT:owner'], 'MERCHANT', 'owner')).toBe(true);
    expect(roleMatches(['MERCHANT:owner'], 'MERCHANT', 'member')).toBe(false);
    expect(roleMatches(['MERCHANT:owner'], 'MERCHANT', null)).toBe(false);
  });

  it('rejects mismatches', () => {
    expect(roleMatches(['ADMIN'], 'MERCHANT', 'owner')).toBe(false);
    expect(roleMatches(['MERCHANT'], 'ADMIN', null)).toBe(false);
  });
});

describe('findPermissionForPath', () => {
  const rows = [
    { path: '/devices', roles: ['ADMIN', 'MERCHANT'] },
    { path: '/devices/claim', roles: ['MERCHANT'] },
    { path: '/user-management', roles: ['ADMIN', 'MERCHANT:owner'] },
  ];

  it('matches exact paths', () => {
    expect(findPermissionForPath(rows, '/devices')?.path).toBe('/devices');
  });

  it('matches nested paths against the deepest ancestor row', () => {
    expect(findPermissionForPath(rows, '/devices/abc')?.path).toBe('/devices');
    expect(findPermissionForPath(rows, '/devices/claim/x')?.path).toBe('/devices/claim');
    expect(findPermissionForPath(rows, '/devices/claim')?.path).toBe('/devices/claim');
  });

  it('returns null when no row covers the path', () => {
    expect(findPermissionForPath(rows, '/dashboard')).toBeNull();
    expect(findPermissionForPath(rows, '/devicesx')).toBeNull();
  });
});

describe('getRole', () => {
  it('resolves ADMIN with no org role', async () => {
    getOrgMock.mockResolvedValue(null);
    const result = await getRole({ id: 'u1', role: 'ADMIN', email: 'a@b.com', name: 'A' });
    expect(result).toEqual({ userRole: 'ADMIN', orgRole: null });
  });

  it('resolves MERCHANT org role from the active organization', async () => {
    getOrgMock.mockResolvedValue({
      id: 'm1',
      organizationId: 'org-1',
      role: 'member',
    });
    const result = await getRole({ id: 'u1', role: 'MERCHANT', email: 'a@b.com', name: 'A' });
    expect(result).toEqual({ userRole: 'MERCHANT', orgRole: 'member' });
  });
});

describe('can', () => {
  it('denies paths with no matching row', async () => {
    state.rows = [
      { path: '/devices', roles: ['ADMIN', 'MERCHANT'] },
      { path: '/user-management', roles: ['ADMIN', 'MERCHANT:owner'] },
    ];
    expect(await can('ADMIN', null, '/merchants')).toBe(false);
  });

  it('allows members on shared rows and denies owner-scoped rows', async () => {
    state.rows = [
      { path: '/devices', roles: ['ADMIN', 'MERCHANT'] },
      { path: '/user-management', roles: ['ADMIN', 'MERCHANT:owner'] },
    ];
    expect(await can('MERCHANT', 'member', '/devices')).toBe(true);
    expect(await can('MERCHANT', 'member', '/devices/abc')).toBe(true);
    expect(await can('MERCHANT', 'member', '/user-management')).toBe(false);
    expect(await can('MERCHANT', 'owner', '/user-management')).toBe(true);
  });
});

describe('listNavForRole', () => {
  const SEED = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      isMenu: true,
      roles: ['ADMIN', 'MERCHANT'],
      sort: 100,
    },
    {
      path: '/devices',
      label: 'Devices',
      icon: 'Smartphone',
      isMenu: true,
      roles: ['ADMIN', 'MERCHANT'],
      sort: 200,
    },
    {
      path: '/devices/new',
      label: 'New device',
      icon: 'Plus',
      isMenu: true,
      roles: ['ADMIN'],
      sort: 300,
    },
    {
      path: '/devices/claim',
      label: 'Claim a device',
      icon: 'Tag',
      isMenu: true,
      roles: ['MERCHANT'],
      sort: 300,
    },
    {
      path: '/user-management',
      label: 'User management',
      icon: 'Users',
      isMenu: true,
      roles: ['ADMIN', 'MERCHANT:owner'],
      sort: 500,
    },
    {
      path: '/merchants',
      label: 'Merchants',
      icon: 'Store',
      isMenu: true,
      roles: ['ADMIN'],
      sort: 600,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: 'Settings',
      isMenu: true,
      roles: ['ADMIN', 'MERCHANT'],
      sort: 9999,
    },
  ];

  beforeEach(() => {
    state.rows = SEED;
  });

  it('admin sees Dashboard/Devices/New device/User management/Merchants/Settings', async () => {
    const nav = await listNavForRole('ADMIN', null);
    expect(nav.map((n) => n.label)).toEqual([
      'Dashboard',
      'Devices',
      'New device',
      'User management',
      'Merchants',
      'Settings',
    ]);
  });

  it('owner sees Devices/Claim and User management', async () => {
    const nav = await listNavForRole('MERCHANT', 'owner');
    expect(nav.map((n) => n.label)).toEqual([
      'Dashboard',
      'Devices',
      'Claim a device',
      'User management',
      'Settings',
    ]);
  });

  it('member sees no User management and no Merchants', async () => {
    const nav = await listNavForRole('MERCHANT', 'member');
    expect(nav.map((n) => n.label)).toEqual(['Dashboard', 'Devices', 'Claim a device', 'Settings']);
  });
});
