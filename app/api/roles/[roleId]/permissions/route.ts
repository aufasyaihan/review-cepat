import { listRolePermissions } from '@/domains/auth/server/permissions';
import { type ApiRouteContext, apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute(
  'GET',
  '/api/roles/:roleId/permissions',
  async (_req, ctx: ApiRouteContext) => {
    await requireApiUser(['ADMIN']);
    const { roleId } = await ctx.params;
    return listRolePermissions(roleId);
  },
);
