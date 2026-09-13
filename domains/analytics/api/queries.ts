import type { AnalyticsOverview } from '@/domains/analytics/server/service';
import { api } from '@/lib/http';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
};

export const analyticsQueries = {
  overview: () => ({
    queryKey: analyticsKeys.overview(),
    queryFn: () => api.get<AnalyticsOverview>('/api/analytics/overview').send(),
  }),
};
