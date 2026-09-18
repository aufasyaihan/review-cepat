import { overview } from '@/domains/analytics/server/service';
import { apiRoute } from '@/lib/api';
import { parseDateRangeQuery } from '@/lib/date-range';
import { requireApiMerchant } from '@/lib/session';

export const GET = apiRoute('GET', '/api/analytics/overview', async (req) => {
  const { user } = await requireApiMerchant();
  const params = new URL(req.url).searchParams;
  const window = params.has('from') || params.has('to') ? parseDateRangeQuery(req.url) : {};
  return overview(user.id, window);
});
