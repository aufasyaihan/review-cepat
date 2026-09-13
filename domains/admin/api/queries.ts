import type { DeviceSummary } from '@/domains/device/types';
import type { MerchantWithDevices } from '@/domains/merchant/server/service';
import { api } from '@/lib/http';

export const adminKeys = {
  all: ['admin'] as const,
  devices: () => [...adminKeys.all, 'devices'] as const,
  merchants: () => [...adminKeys.all, 'merchants'] as const,
  newlyCreated: () => [...adminKeys.all, 'new'] as const,
};

export const adminQueries = {
  devices: () => ({
    queryKey: adminKeys.devices(),
    queryFn: () => api.get<DeviceSummary[]>('/api/admin/devices').send(),
  }),
  merchants: () => ({
    queryKey: adminKeys.merchants(),
    queryFn: () => api.get<MerchantWithDevices[]>('/api/admin/merchants').send(),
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
