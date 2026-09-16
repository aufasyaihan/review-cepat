import { adminOverview } from '@/domains/analytics/server/service';
import { apiRoute } from '@/lib/api';
import { parseDateRangeQuery } from '@/lib/date-range';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/analytics/admin-overview', async (req) => {
  const user = await requireApiUser(['ADMIN']);
  const params = new URL(req.url).searchParams;
  const window = params.has('from') || params.has('to') ? parseDateRangeQuery(req.url) : {};
  return adminOverview(user, window);
});
