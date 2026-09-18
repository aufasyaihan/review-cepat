import { deleteUserAction, updateUserAction } from '@/domains/merchant/server/member-actions';
import { apiRoute, fromActionResult } from '@/lib/api';

export const PATCH = apiRoute('PATCH', '/api/members/[memberId]', async (req, ctx) => {
  const { memberId } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  return fromActionResult(await updateUserAction({ ...body, memberId }));
});

export const DELETE = apiRoute('DELETE', '/api/members/[memberId]', async (_req, ctx) => {
  const { memberId } = await ctx.params;
  return fromActionResult(await deleteUserAction(memberId));
});
