import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible } from '@/domains/device/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireMembership } from '@/lib/session';
import { DevicesClient } from './devices-client';

export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
  const { membership } = await requireMembership();
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => listVisible(membership),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevicesClient />
    </HydrationBoundary>
  );
}
