import { searchPlaces } from '@/domains/destination/server/service';
import { apiRoute } from '@/lib/api';
import { UnauthorizedError } from '@/lib/errors';
import { requireApiMerchant } from '@/lib/session';
import { verifySetupToken } from '@/lib/setup-token';

/**
 * Public accountless setup (/s/{slug}/setup/redirect) also needs to search
 * places before any account exists, so it authenticates with the same
 * short-lived setup token as saveSetupDestinationsAction instead of a
 * merchant session.
 */
export const GET = apiRoute('GET', '/api/destination/places', async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('query') ?? '';
  const deviceId = url.searchParams.get('deviceId');
  const token = url.searchParams.get('t');

  if (deviceId && token) {
    if (!verifySetupToken(token, deviceId)) {
      throw new UnauthorizedError('Setup session expired or invalid');
    }
  } else {
    await requireApiMerchant();
  }

  return searchPlaces(query);
});
