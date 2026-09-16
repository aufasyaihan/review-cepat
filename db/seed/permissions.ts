import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from '@/db';
import { masterRole, permission, rolePermission } from '@/db/schema';

// Normalized permission model (Clarification 2026-09-16, FR-037):
// - master_role holds the platform roles ADMIN and MERCHANT only.
// - permission holds nav rows (is_menu=true) and API-endpoint rows
//   (is_menu=false, parentId = the page row they serve, dotted label
//   `api.<action>`). NO role column.
// - role_permission links a master role to a permission. A link with a
//   `scope` of `owner` only grants the permission to a MERCHANT whose active
//   organization role is owner; `member` restricts to members; null/`both`
//   grants regardless of org role. ADMIN is a superuser at the guard layer
//   (FR-041) but links are still seeded so nav/self-list render all items.
export const PERMISSION_ROWS: Array<{
  path: string;
  label: string;
  icon: string;
  isMenu: boolean;
  sort: number;
  parentPath?: string;
}> = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    isMenu: true,
    sort: 100,
  },
  {
    path: '/devices',
    label: 'Devices',
    icon: 'Smartphone',
    isMenu: true,
    sort: 200,
  },
  {
    path: '/devices/claim',
    label: 'Claim a device',
    icon: 'Tag',
    isMenu: true,
    sort: 300,
  },
  {
    path: '/user-management',
    label: 'User management',
    icon: 'Users',
    isMenu: true,
    sort: 500,
  },
  {
    path: '/merchants',
    label: 'Merchants',
    icon: 'Store',
    isMenu: true,
    sort: 600,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'Settings',
    isMenu: true,
    sort: 9999,
  },
  // ── API-endpoint rows (is_menu=false, label `api.<action>`, parent = page) ──
  {
    path: '/api/device/create',
    label: 'api.create_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/claim',
    label: 'api.claim_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices/claim',
  },
  {
    path: '/api/device/publish',
    label: 'api.publish_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/unpublish',
    label: 'api.unpublish_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/transfer',
    label: 'api.transfer_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/reset',
    label: 'api.reset_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/disable',
    label: 'api.disable_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/device/delete',
    label: 'api.delete_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/devices',
  },
  {
    path: '/api/member/invite',
    label: 'api.invite_member',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/user-management',
  },
  {
    path: '/api/member/assign',
    label: 'api.assign_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/user-management',
  },
  {
    path: '/api/member/unassign',
    label: 'api.unassign_device',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/user-management',
  },
  {
    path: '/api/permissions',
    label: 'api.list_my_permissions',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/dashboard',
  },
  {
    path: '/api/roles/:roleId/permissions',
    label: 'api.list_role_permissions',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/dashboard',
  },
  {
    path: '/api/analytics/admin-overview',
    label: 'api.admin_overview',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/dashboard',
  },
  {
    path: '/api/analytics/overview',
    label: 'api.overview',
    icon: '',
    isMenu: false,
    sort: 0,
    parentPath: '/dashboard',
  },
];

export const MASTER_ROLE_ROWS = ['ADMIN', 'MERCHANT'] as const;

/**
 * Per-permission role links. `ALL` grants every role; a single value applies
 * to that role. Value forms: `null` (no scope), 'owner', 'member', 'both'.
 */
const LINK_ROWS: Array<{
  path: string;
  admin: boolean;
  merchantScope?: 'owner' | 'member' | 'both' | null;
}> = [
  { path: '/dashboard', admin: true, merchantScope: null },
  { path: '/devices', admin: true, merchantScope: null },
  { path: '/devices/claim', admin: false, merchantScope: null },
  { path: '/user-management', admin: true, merchantScope: 'owner' },
  { path: '/merchants', admin: true, merchantScope: null },
  { path: '/settings', admin: true, merchantScope: null },
  { path: '/api/device/create', admin: true, merchantScope: null },
  { path: '/api/device/claim', admin: false, merchantScope: null },
  { path: '/api/device/publish', admin: false, merchantScope: null },
  { path: '/api/device/unpublish', admin: false, merchantScope: null },
  { path: '/api/device/transfer', admin: false, merchantScope: null },
  { path: '/api/device/reset', admin: true, merchantScope: 'owner' },
  { path: '/api/device/disable', admin: true, merchantScope: null },
  { path: '/api/device/delete', admin: true, merchantScope: null },
  { path: '/api/member/invite', admin: true, merchantScope: 'owner' },
  { path: '/api/member/assign', admin: true, merchantScope: 'owner' },
  { path: '/api/member/unassign', admin: true, merchantScope: 'owner' },
  { path: '/api/permissions', admin: true, merchantScope: null },
  { path: '/api/roles/:roleId/permissions', admin: true, merchantScope: null },
  { path: '/api/analytics/admin-overview', admin: true, merchantScope: null },
  { path: '/api/analytics/overview', admin: true, merchantScope: 'owner' },
];

/** Idempotent; safe to run on every seed/dev/test boot. */
export async function ensurePermissions(db: Db): Promise<void> {
  const now = new Date();

  const roleIds = new Map<string, string>();
  for (const name of MASTER_ROLE_ROWS) {
    const existing = await db.query.masterRole.findFirst({
      where: eq(masterRole.name, name),
    });
    if (existing) {
      roleIds.set(name, existing.id);
      continue;
    }
    const id = randomUUID();
    await db.insert(masterRole).values({ id, name, createdAt: now });
    roleIds.set(name, id);
  }

  const permIds = new Map<string, string>();
  for (const row of PERMISSION_ROWS) {
    const existing = await db.query.permission.findFirst({
      where: eq(permission.path, row.path),
    });
    if (existing) {
      permIds.set(row.path, existing.id);
      continue;
    }
    const id = randomUUID();
    await db.insert(permission).values({
      id,
      path: row.path,
      label: row.label,
      icon: row.icon || null,
      isMenu: row.isMenu,
      parentId: row.parentPath ? (permIds.get(row.parentPath) ?? null) : null,
      sort: row.sort,
      createdAt: now,
    });
    permIds.set(row.path, id);
  }

  for (const link of LINK_ROWS) {
    const permissionId = permIds.get(link.path);
    if (!permissionId) continue;
    if (link.admin) {
      await ensureLink(db, roleIds, 'ADMIN', permissionId, null, now);
    }
    await ensureLink(db, roleIds, 'MERCHANT', permissionId, link.merchantScope ?? null, now);
  }
}

async function ensureLink(
  db: Db,
  roleIds: Map<string, string>,
  roleName: string,
  permissionId: string,
  scope: 'owner' | 'member' | 'both' | null,
  now: Date,
): Promise<void> {
  const roleId = roleIds.get(roleName);
  if (!roleId) return;
  const existing = await db.query.rolePermission.findFirst({
    where: (t, { and }) =>
      scope === null
        ? and(eq(t.roleId, roleId), eq(t.permissionId, permissionId), isNull(t.scope))
        : and(eq(t.roleId, roleId), eq(t.permissionId, permissionId), eq(t.scope, scope)),
  });
  if (existing) return;
  await db.insert(rolePermission).values({
    id: randomUUID(),
    roleId,
    permissionId,
    scope,
    createdAt: now,
  });
}
