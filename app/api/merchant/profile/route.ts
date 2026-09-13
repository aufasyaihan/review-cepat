import { getProfileByUserId, upsertProfile } from '@/domains/merchant/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant, requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/merchant/profile', async () => {
  const user = await requireApiUser(['MERCHANT']);
  return getProfileByUserId(user.id);
});

export const POST = apiRoute('POST', '/api/merchant/profile', async (req) => {
  const user = await requireApiMerchant();
  const body = await req.json().catch(() => ({}));
  return upsertProfile(user.user.id, body);
});
