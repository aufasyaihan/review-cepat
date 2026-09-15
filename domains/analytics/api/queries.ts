import type {
  AnalyticsBreakdown,
  AnalyticsOverview,
  BreakdownDimension,
} from '@/domains/analytics/server/service';
import { api } from '@/lib/http';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
  breakdown: (deviceId: string, dimension: BreakdownDimension) =>
    [...analyticsKeys.all, 'breakdown', deviceId, dimension] as const,
};

export const analyticsQueries = {
  overview: () => ({
    queryKey: analyticsKeys.overview(),
    queryFn: () => api.get<AnalyticsOverview>('/api/analytics/overview').send(),
  }),
  breakdown: (deviceId: string, dimension: BreakdownDimension) => ({
    queryKey: analyticsKeys.breakdown(deviceId, dimension),
    queryFn: () =>
      api
        .get<AnalyticsBreakdown>('/api/analytics/breakdown')
        .setQuery({ deviceId, dimension })
        .send(),
  }),
};
