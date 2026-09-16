import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import type { Db } from '@/db';
import { permission } from '@/db/schema';

// One row per path (path is UNIQUE in the schema). Where a path is scoped to the
// org owner only, the roles JSON carries a `<ROLE>:<orgRole>` token — e.g.
// `/user-management` is `['ADMIN', 'MERCHANT:owner']`, so members are denied it.
//
// Two row kinds (Clarification 2026-09-16, FR-037):
// - Navigation rows: `isMenu=true`, `parentPath` undefined — sidebar items / pages.
// - API-endpoint rows: `isMenu=false`, `parentPath` = the page they serve,
//   `path` = the endpoint, dotted `label` (e.g. `api.create_device`). Gap labels
//   resolve to parent nav rows by path at insert; `can()` gates them at the
//   API layer.
export const PERMISSION_ROWS: Array<{
  path: string;
  label: string;
  icon: string;
  isMenu: boolean;
  roles: string[];
  sort: number;
  parentPath?: string;
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
  // ── API-endpoint rows (is_menu=false, label `api.<action>`, parent = page) ──
  {
    path: '/api/device/create',
    label: 'api.create_device',
    icon: '',
    isMenu: false,
    roles: ['ADMIN'],
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/claim',
    label: 'api.claim_device',
    icon: '',
    isMenu: false,
    roles: ['MERCHANT'],
    sort: 0,
    parentPath: '/devices/claim',
  },
  {
    path: '/api/device/publish',
    label: 'api.publish_device',
    icon: '',
    isMenu: false,
    roles: ['MERCHANT'],
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/unpublish',
    label: 'api.unpublish_device',
    icon: '',
    isMenu: false,
    roles: ['MERCHANT'],
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/transfer',
    label: 'api.transfer_device',
    icon: '',
    isMenu: false,
    roles: ['MERCHANT'],
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/reset',
    label: 'api.reset_device',
    icon: '',
    isMenu: false,
    roles: ['ADMIN', 'MERCHANT:owner'],
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/disable',
    label: 'api.disable_device',
    icon: '',
    isMenu: false,
    roles: ['ADMIN'],
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/delete',
    label: 'api.delete_device',
    icon: '',
    isMenu: false,
    roles: ['ADMIN'],
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/member/invite',
    label: 'api.invite_member',
    icon: '',
    isMenu: false,
    roles: ['ADMIN', 'MERCHANT:owner'],
    sort: 0,
    parentPath: '/user-management',
  },
  {
    path: '/api/member/assign',
    label: 'api.assign_device',
    icon: '',
    isMenu: false,
    roles: ['ADMIN', 'MERCHANT:owner'],
    sort: 0,
    parentPath: '/user-management',
  },
  {
    path: '/api/member/unassign',
    label: 'api.unassign_device',
    icon: '',
    isMenu: false,
    roles: ['ADMIN', 'MERCHANT:owner'],
    sort: 0,
    parentPath: '/user-management',
  },
];

/** Idempotent by `path`; safe to run on every seed/dev/test boot. */
export async function ensurePermissions(db: Db): Promise<void> {
  const now = new Date();
  const byPath = new Map<string, string>();
  for (const row of PERMISSION_ROWS) {
    const existing = await db.query.permission.findFirst({
      where: eq(permission.path, row.path),
    });
    if (existing) {
      byPath.set(row.path, existing.id);
      continue;
    }
    const id = randomUUID();
    await db.insert(permission).values({
      id,
      path: row.path,
      label: row.label,
      icon: row.icon || null,
      isMenu: row.isMenu,
      parentId: row.parentPath ? (byPath.get(row.parentPath) ?? null) : null,
      roles: row.roles,
      sort: row.sort,
      createdAt: now,
    });
    byPath.set(row.path, id);
  }
}
