import { api } from '@/lib/http';

export type SelfPermission = {
  path: string;
  isMenu: boolean;
  label: string;
  icon: string | null;
  sort: number;
};

export type RolePermission = {
  path: string;
  isMenu: boolean;
  label: string;
  scope: 'owner' | 'member' | 'both' | null;
};

export const authKeys = {
  all: ['auth'] as const,
  permissions: () => [...authKeys.all, 'permissions'] as const,
  rolePermissions: (roleId: string) => [...authKeys.all, 'permissions', roleId] as const,
};

export const authQueries = {
  permissions: () => ({
    queryKey: authKeys.permissions(),
    queryFn: () => api.get<SelfPermission[]>('/api/permissions').send(),
    staleTime: 5 * 60 * 1000,
  }),
  rolePermissions: (roleId: string) => ({
    queryKey: authKeys.rolePermissions(roleId),
    queryFn: () => api.get<RolePermission[]>(`/api/roles/${roleId}/permissions`).send(),
  }),
};
