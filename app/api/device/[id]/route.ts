import { getVisible } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMembership } from '@/lib/session';

export const GET = apiRoute('GET', '/api/device/[id]', async (_req, ctx) => {
  const membership = await requireApiMembership();
  const { id } = await ctx.params;
  return getVisible(id, membership);
});
