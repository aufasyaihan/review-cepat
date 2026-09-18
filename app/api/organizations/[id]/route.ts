import {
  deleteMerchantAction,
  updateOrganizationAction,
} from '@/domains/merchant/server/org-actions';
import { apiRoute, fromActionResult } from '@/lib/api';

export const PATCH = apiRoute('PATCH', '/api/organizations/[id]', async (req, ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  return fromActionResult(await updateOrganizationAction({ ...body, organizationId: id }));
});

export const DELETE = apiRoute('DELETE', '/api/organizations/[id]', async (_req, ctx) => {
  const { id } = await ctx.params;
  return fromActionResult(await deleteMerchantAction(id));
});
