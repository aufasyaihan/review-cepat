import { getRole, listPermissionsForRole } from '@/domains/auth/server/permissions';
import { apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/permissions', async () => {
  const user = await requireApiUser(['ADMIN', 'MERCHANT']);
  const { orgRole } = await getRole(user);
  return listPermissionsForRole(user.role, orgRole);
});
