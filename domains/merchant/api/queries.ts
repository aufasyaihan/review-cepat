import type { ProfileOutput } from '@/domains/merchant/schemas/profile';
import type {
  AdminUserRow,
  MemberWithUser,
  OrganizationWithDevices,
  Paginated,
} from '@/domains/merchant/server/service';
import { api } from '@/lib/http';

export const merchantKeys = {
  all: ['merchant'] as const,
  profile: () => [...merchantKeys.all, 'profile'] as const,
};

export const memberKeys = {
  list: () => [...merchantKeys.all, 'members'] as const,
};

export const adminUserKeys = {
  list: (params: { q?: string; organizationId?: string; page?: number; limit?: number }) =>
    [...merchantKeys.all, 'admin-users', params] as const,
};

export const adminMerchantKeys = {
  list: (params: { q?: string; page?: number; limit?: number }) =>
    [...merchantKeys.all, 'admin-merchants', params] as const,
  options: (q?: string) => [...merchantKeys.all, 'admin-merchant-options', q ?? ''] as const,
};

export const merchantQueries = {
  profile: () => ({
    queryKey: merchantKeys.profile(),
    queryFn: () => api.get<ProfileOutput | null>('/api/merchant/profile').send(),
  }),
};

export const memberQueries = {
  list: () => ({
    queryKey: memberKeys.list(),
    queryFn: () => api.get<MemberWithUser[]>('/api/merchant/members').send(),
  }),
};

/** Admin server-driven lists (FR-055) — pagination/filtering happen server-side. */
export const adminUserListQuery = (params: {
  q?: string;
  organizationId?: string;
  page?: number;
  limit?: number;
}) => ({
  queryKey: adminUserKeys.list(params),
  queryFn: () => api.get<Paginated<AdminUserRow>>('/api/members').setQuery(params).send(),
});

export const adminMerchantListQuery = (params: { q?: string; page?: number; limit?: number }) => ({
  queryKey: adminMerchantKeys.list(params),
  queryFn: () =>
    api.get<Paginated<OrganizationWithDevices>>('/api/organizations').setQuery(params).send(),
});
