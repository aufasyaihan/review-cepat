import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { deviceKeys } from '@/domains/device/api/queries';
import { listOwned } from '@/domains/device/server/service';
import { getProfileByUserId } from '@/domains/merchant/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { DevicesClient } from './devices-client';

export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
  const user = await requireRole('MERCHANT');
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: async () => {
      const profile = await getProfileByUserId(user.id);
      return profile ? listOwned(profile.id) : [];
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevicesClient />
    </HydrationBoundary>
  );
}
