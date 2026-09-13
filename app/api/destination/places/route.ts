import { searchPlaces } from '@/domains/destination/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const GET = apiRoute('GET', '/api/destination/places', async (req) => {
  await requireApiMerchant();
  const query = new URL(req.url).searchParams.get('query') ?? '';
  return searchPlaces(query);
});
