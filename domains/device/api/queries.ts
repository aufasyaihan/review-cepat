import type { DeviceDetail, DeviceSummary } from '@/domains/device/types';
import { api } from '@/lib/http';
import type { Paginated } from '@/lib/pagination';

export const deviceKeys = {
  all: ['device'] as const,
  lists: (organizationId?: string) => [...deviceKeys.all, 'list', organizationId] as const,
  paginated: (params: { organizationId?: string; q?: string; page?: number; limit?: number }) =>
    [...deviceKeys.lists(params.organizationId), 'paginated', params] as const,
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
  /** Server-driven page (FR-055 parity): pagination + name search for table UIs. */
  paginatedList: (params: {
    organizationId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => ({
    queryKey: deviceKeys.paginated(params),
    queryFn: () => api.get<Paginated<DeviceSummary>>('/api/device').setQuery(params).send(),
  }),
  detail: (id: string) => ({
    queryKey: deviceKeys.detail(id),
    queryFn: () => api.get<DeviceDetail>(`/api/device/${id}`).send(),
  }),
};
