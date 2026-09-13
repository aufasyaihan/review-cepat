import { overview } from '@/domains/analytics/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const GET = apiRoute('GET', '/api/analytics/overview', async () => {
  const { user } = await requireApiMerchant();
  return overview(user.id);
});
