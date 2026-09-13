import { adminSetDisabled } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const POST = apiRoute('POST', '/api/admin/devices/[id]/enable', async (_req, ctx) => {
  await requireApiUser(['ADMIN']);
  const { id } = await ctx.params;
  return adminSetDisabled(id, false);
});
