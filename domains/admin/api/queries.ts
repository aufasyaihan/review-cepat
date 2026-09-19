import type { DeviceSummary } from '@/domains/device/types';
import type {
  MerchantWithDevices,
  OrganizationWithDevices,
} from '@/domains/merchant/server/service';
import { api } from '@/lib/http';
import type { Paginated } from '@/lib/pagination';

export const adminKeys = {
  all: ['admin'] as const,
  devices: () => [...adminKeys.all, 'devices'] as const,
  paginatedDevices: (params: { q?: string; page?: number; limit?: number }) =>
    [...adminKeys.devices(), 'paginated', params] as const,
  merchants: () => [...adminKeys.all, 'merchants'] as const,
  organizations: () => [...adminKeys.all, 'organizations'] as const,
};

export const adminQueries = {
  devices: () => ({
    queryKey: adminKeys.devices(),
    queryFn: () => api.get<DeviceSummary[]>('/api/admin/devices').send(),
  }),
  /** Server-driven page (FR-055 parity): pagination + name search for the admin device table. */
  paginatedDevices: (params: { q?: string; page?: number; limit?: number }) => ({
    queryKey: adminKeys.paginatedDevices(params),
    queryFn: () => api.get<Paginated<DeviceSummary>>('/api/admin/devices').setQuery(params).send(),
  }),
  merchants: () => ({
    queryKey: adminKeys.merchants(),
    queryFn: () => api.get<MerchantWithDevices[]>('/api/admin/merchants').send(),
  }),
  organizations: () => ({
    queryKey: adminKeys.organizations(),
    queryFn: () => api.get<OrganizationWithDevices[]>('/api/admin/organizations').send(),
  }),
};

export const adminMutations = {
  create: () => ({
    mutationFn: (name: string) =>
      api
        .post<{ device: DeviceSummary; claimCode: string }>('/api/admin/devices')
        .setBody({ name })
        .send(),
  }),
  disable: (id: string) => ({
    mutationFn: () => api.post<DeviceSummary>(`/api/admin/devices/${id}/disable`).send(),
  }),
  enable: (id: string) => ({
    mutationFn: () => api.post<DeviceSummary>(`/api/admin/devices/${id}/enable`).send(),
  }),
};
