import type {
  AnalyticsBreakdown,
  AnalyticsOverview,
  BreakdownDimension,
} from '@/domains/analytics/server/service';
import { api } from '@/lib/http';

export type AnalyticsRange = { from?: Date; to?: Date };

const rangeKey = (range: AnalyticsRange): string => {
  if (!range.from || !range.to) return 'all';
  return `${range.from.toISOString()}-${range.to.toISOString()}`;
};

const rangeQuery = (range: AnalyticsRange): Record<string, string | undefined> => ({
  from: range.from?.toISOString(),
  to: range.to?.toISOString(),
});

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (range: AnalyticsRange = {}) =>
    [...analyticsKeys.all, 'overview', rangeKey(range)] as const,
  adminOverview: (range: AnalyticsRange = {}) =>
    [...analyticsKeys.all, 'admin-overview', rangeKey(range)] as const,
  breakdown: (deviceId: string, dimension: BreakdownDimension) =>
    [...analyticsKeys.all, 'breakdown', deviceId, dimension] as const,
};

export const analyticsQueries = {
  overview: (range: AnalyticsRange = {}) => ({
    queryKey: analyticsKeys.overview(range),
    queryFn: () =>
      api.get<AnalyticsOverview>('/api/analytics/overview').setQuery(rangeQuery(range)).send(),
  }),
  adminOverview: (range: AnalyticsRange = {}) => ({
    queryKey: analyticsKeys.adminOverview(range),
    queryFn: () =>
      api
        .get<AnalyticsOverview>('/api/analytics/admin-overview')
        .setQuery(rangeQuery(range))
        .send(),
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
