import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';

import { deviceKeys } from '@/domains/device/api/queries';
import { getVisible } from '@/domains/device/server/service';
import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export default async function DeviceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) redirect('/devices');

  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: deviceKeys.detail(id),
      queryFn: () => getVisible(id, membership),
      retry: false,
    });
  } catch {
    notFound();
  }

  const members = await queryClient.fetchQuery({
    queryKey: memberKeys.list(),
    queryFn: () => memberQueries.list().queryFn(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsClient deviceId={id} isOwner={true} members={members} />
    </HydrationBoundary>
  );
}
