import { type BreakdownDimension, breakdown } from '@/domains/analytics/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const GET = apiRoute('GET', '/api/analytics/breakdown', async (req) => {
  const { user } = await requireApiMerchant();
  const params = new URL(req.url).searchParams;
  const deviceId = params.get('deviceId') ?? '';
  const dimension = (params.get('dimension') ?? 'browser') as BreakdownDimension;
  return breakdown(user.id, deviceId, dimension);
});
