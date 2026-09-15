import { publishVisible } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMembership } from '@/lib/session';

export const POST = apiRoute('POST', '/api/device/[id]/publish', async (_req, ctx) => {
  const membership = await requireApiMembership();
  const { id } = await ctx.params;
  return publishVisible(id, membership);
});
