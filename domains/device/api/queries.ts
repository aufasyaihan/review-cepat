import type { DeviceDetail, DeviceSummary } from '@/domains/device/types';
import { api } from '@/lib/http';

export const deviceKeys = {
  all: ['device'] as const,
  lists: (organizationId?: string) => [...deviceKeys.all, 'list', organizationId] as const,
  detail: (id: string) => [...deviceKeys.all, 'detail', id] as const,
};

export const deviceQueries = {
  list: (organizationId?: string) => ({
    queryKey: deviceKeys.lists(organizationId),
    queryFn: () =>
      api
        .get<DeviceSummary[]>('/api/device')
        .setQuery(organizationId ? { organizationId } : {})
        .send(),
  }),
  detail: (id: string) => ({
    queryKey: deviceKeys.detail(id),
    queryFn: () => api.get<DeviceDetail>(`/api/device/${id}`).send(),
  }),
};
