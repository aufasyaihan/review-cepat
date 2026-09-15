import type { Role } from '@/domains/auth/constants';
import { ForbiddenError } from '@/lib/errors';

export function requireDestinationRole(role: Role): void {
  if (role !== 'MERCHANT') {
    throw new ForbiddenError('DESTINATION_FORBIDDEN', 'Only merchants can configure destinations');
  }
}
