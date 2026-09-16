import { getTableName, type Table } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db';

const tables = vi.hoisted(() => ({
  master_role: [] as Record<string, unknown>[],
  permission: [] as Record<string, unknown>[],
  role_permission: [] as Record<string, unknown>[],
}));

interface DrizzleTable {
  [key: symbol]: string;
}

vi.mock('@/db', () => {
  return {
    getDb: () => ({
      select: () => ({
        from: (table: Table) => {
          const name = getTableName(table);
          const rows = tables[name as keyof typeof tables] ?? [];
          const thenable = (rowsToReturn: Record<string, unknown>[]) =>
            Object.assign(Promise.resolve(rowsToReturn), {
              where: () => thenable(rowsToReturn),
              orderBy: () => thenable(rowsToReturn),
              limit: () => thenable(rowsToReturn),
              innerJoin: (right: DrizzleTable) => {
                const rightName = right[Symbol.for('drizzle:Name')];
                const rightRows = tables[rightName as keyof typeof tables] ?? [];
                const rightById = new Map(rightRows.map((r) => [r.id, r]));
                const joined = rowsToReturn.map((l) => ({
                  ...l,
                  ...(rightById.get(l.permissionId as string) ?? {}),
                }));
                return thenable(joined);
              },
            });
          return thenable(rows);
        },
      }),
    }),
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
  scopeAllows,
} from '@/domains/auth/server/permissions';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';

const getOrgMock = vi.mocked(getActiveOrganization);

type Link = {
  path: string;
  isMenu: boolean;
  label: string;
  icon: string | null;
  sort: number;
  scope: string | null;
};

function seed(links: Link[]): void {
  tables['master_role'] = [{ id: 'r-1', name: 'MERCHANT' }];
  tables['permission'] = links.map((l) => ({ ...l, id: `p-${l.path}` }));
  tables['role_permission'] = links.map((l) => ({
    id: `rp-${l.path}-${l.scope ?? 'any'}`,
    roleId: 'r-1',
    permissionId: `p-${l.path}`,
    scope: l.scope,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  tables['master_role'] = [];
  tables['permission'] = [];
  tables['role_permission'] = [];
});

describe('scopeAllows', () => {
  it('allows null and both regardless of org role', () => {
    expect(scopeAllows(null, 'owner')).toBe(true);
    expect(scopeAllows(null, 'member')).toBe(true);
    expect(scopeAllows('both', 'owner')).toBe(true);
    expect(scopeAllows('both', 'member')).toBe(true);
  });

  it('allows owner/member scopes only for the matching org role', () => {
    expect(scopeAllows('owner', 'owner')).toBe(true);
    expect(scopeAllows('owner', 'member')).toBe(false);
    expect(scopeAllows('owner', null)).toBe(false);
    expect(scopeAllows('member', 'member')).toBe(true);
    expect(scopeAllows('member', 'owner')).toBe(false);
  });
});

describe('findPermissionForPath', () => {
  const rows = [{ path: '/devices' }, { path: '/devices/claim' }, { path: '/user-management' }];

  it('matches exact and nested paths against the deepest row', () => {
    expect(findPermissionForPath(rows, '/devices')?.path).toBe('/devices');
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
    getOrgMock.mockResolvedValue({ id: 'm1', organizationId: 'org-1', role: 'member' });
    const result = await getRole({ id: 'u1', role: 'MERCHANT', email: 'a@b.com', name: 'A' });
    expect(result).toEqual({ userRole: 'MERCHANT', orgRole: 'member' });
  });
});

describe('can', () => {
  it('ADMIN is a superuser: allowed for any path, even with no links seeded', async () => {
    expect(await can('ADMIN', null, '/merchants')).toBe(true);
    expect(await can('ADMIN', null, '/api/device/claim')).toBe(true);
    expect(await can('ADMIN', null, '/nope')).toBe(true);
  });

  it('MERCHANT is denied when path has no role_permission link', async () => {
    seed([
      {
        path: '/devices',
        isMenu: true,
        label: 'Devices',
        icon: 'Smartphone',
        sort: 200,
        scope: null,
      },
    ]);
    expect(await can('MERCHANT', 'member', '/merchants')).toBe(false);
    expect(await can('MERCHANT', 'member', '/dashboard')).toBe(false);
  });

  it('MERCHANT allowed on unscoped links for any org role', async () => {
    seed([
      {
        path: '/devices',
        isMenu: true,
        label: 'Devices',
        icon: 'Smartphone',
        sort: 200,
        scope: null,
      },
    ]);
    expect(await can('MERCHANT', 'member', '/devices')).toBe(true);
    expect(await can('MERCHANT', 'member', '/devices/abc')).toBe(true);
    expect(await can('MERCHANT', 'owner', '/devices')).toBe(true);
  });

  it('MERCHANT owner-scoped links allowed only for owners', async () => {
    seed([
      {
        path: '/user-management',
        isMenu: true,
        label: 'User management',
        icon: 'Users',
        sort: 500,
        scope: 'owner',
      },
    ]);
    expect(await can('MERCHANT', 'owner', '/user-management')).toBe(true);
    expect(await can('MERCHANT', 'member', '/user-management')).toBe(false);
    expect(await can('MERCHANT', null, '/user-management')).toBe(false);
  });

  it('gates API-endpoint rows by scope', async () => {
    seed([
      {
        path: '/api/device/publish',
        isMenu: false,
        label: 'api.publish_device',
        icon: null,
        sort: 0,
        scope: null,
      },
      {
        path: '/api/member/invite',
        isMenu: false,
        label: 'api.invite_member',
        icon: null,
        sort: 0,
        scope: 'owner',
      },
    ]);
    expect(await can('MERCHANT', 'member', '/api/device/publish')).toBe(true);
    expect(await can('MERCHANT', 'owner', '/api/member/invite')).toBe(true);
    expect(await can('MERCHANT', 'member', '/api/member/invite')).toBe(false);
  });
});

describe('listNavForRole', () => {
  const SEED_LINKS: Link[] = [
    {
      path: '/dashboard',
      isMenu: true,
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      sort: 100,
      scope: null,
    },
    {
      path: '/devices',
      isMenu: true,
      label: 'Devices',
      icon: 'Smartphone',
      sort: 200,
      scope: null,
    },
    {
      path: '/devices/claim',
      isMenu: true,
      label: 'Claim a device',
      icon: 'Tag',
      sort: 300,
      scope: null,
    },
    {
      path: '/user-management',
      isMenu: true,
      label: 'User management',
      icon: 'Users',
      sort: 500,
      scope: 'owner',
    },
    {
      path: '/merchants',
      isMenu: true,
      label: 'Merchants',
      icon: 'Store',
      sort: 600,
      scope: 'owner',
    },
    {
      path: '/settings',
      isMenu: true,
      label: 'Settings',
      icon: 'Settings',
      sort: 9999,
      scope: null,
    },
    {
      path: '/api/device/publish',
      isMenu: false,
      label: 'api.publish_device',
      icon: null,
      sort: 0,
      scope: null,
    },
  ];

  beforeEach(() => {
    seed(SEED_LINKS);
  });

  it('owner sees Dashboard/Devices/Claim/User management/Merchants/Settings', async () => {
    const nav = await listNavForRole('MERCHANT', 'owner');
    expect(nav.map((n) => n.label)).toEqual([
      'Dashboard',
      'Devices',
      'Claim a device',
      'User management',
      'Merchants',
      'Settings',
    ]);
  });

  it('member sees no owner-scoped items', async () => {
    const nav = await listNavForRole('MERCHANT', 'member');
    expect(nav.map((n) => n.label)).toEqual(['Dashboard', 'Devices', 'Claim a device', 'Settings']);
  });
});
