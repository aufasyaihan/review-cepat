import type { DeviceDetail, DeviceSummary } from '@/domains/device/types';
import { api } from '@/lib/http';

export const deviceKeys = {
  all: ['device'] as const,
  lists: () => [...deviceKeys.all, 'list'] as const,
  detail: (id: string) => [...deviceKeys.all, 'detail', id] as const,
};

export const deviceQueries = {
  list: () => ({
    queryKey: deviceKeys.lists(),
    queryFn: () => api.get<DeviceSummary[]>('/api/device').send(),
  }),
  detail: (id: string) => ({
    queryKey: deviceKeys.detail(id),
    queryFn: () => api.get<DeviceDetail>(`/api/device/${id}`).send(),
  }),
};
