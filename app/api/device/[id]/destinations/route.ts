import { setForDevice } from '@/domains/destination/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMembership } from '@/lib/session';

export const POST = apiRoute('POST', '/api/device/[id]/destinations', async (req, ctx) => {
  const membership = await requireApiMembership();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return setForDevice(id, membership, body);
});
