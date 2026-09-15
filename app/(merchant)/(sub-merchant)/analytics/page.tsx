import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { analyticsKeys } from '@/domains/analytics/api/queries';
import { overview } from '@/domains/analytics/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { AnalyticsClient } from './analytics-client';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const user = await requireRole('MERCHANT');
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: analyticsKeys.overview(),
    queryFn: () => overview(user.id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnalyticsClient />
    </HydrationBoundary>
  );
}
