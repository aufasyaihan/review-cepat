import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import type { Db } from '@/db';
import { permission } from '@/db/schema';

// One row per path (path is UNIQUE in the schema). Where a path is scoped to the
// org owner only, the roles JSON carries a `<ROLE>:<orgRole>` token — e.g.
// `/user-management` is `['ADMIN', 'MERCHANT:owner']`, so members are denied it.
export const PERMISSION_ROWS: Array<{
  path: string;
  label: string;
  icon: string;
  isMenu: boolean;
  roles: string[];
  sort: number;
}> = [
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

/** Idempotent by `path`; safe to run on every seed/dev/test boot. */
export async function ensurePermissions(db: Db): Promise<void> {
  const now = new Date();
  for (const row of PERMISSION_ROWS) {
    const existing = await db.query.permission.findFirst({
      where: eq(permission.path, row.path),
    });
    if (existing) continue;
    await db.insert(permission).values({
      id: randomUUID(),
      path: row.path,
      label: row.label,
      icon: row.icon,
      isMenu: row.isMenu,
      roles: row.roles,
      sort: row.sort,
      createdAt: now,
    });
  }
}
