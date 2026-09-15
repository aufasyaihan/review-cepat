import { listVisible } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMembership } from '@/lib/session';

export const GET = apiRoute('GET', '/api/device', async () => {
  const membership = await requireApiMembership();
  return listVisible(membership);
});
