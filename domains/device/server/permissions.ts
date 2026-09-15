import type { Role } from '@/domains/auth/constants';
import { ForbiddenError } from '@/lib/errors';

/**
 * Device permissions. Ownership is enforced by passing the session-derived
 * owner (merchant profile) id into every service call; roles gate capabilities.
 */
export function canManageDevices(role: Role): boolean {
  return role === 'MERCHANT' || role === 'ADMIN';
}

export function requireDeviceRole(role: Role): void {
  if (role !== 'MERCHANT' && role !== 'ADMIN') {
    throw new ForbiddenError('DEVICE_FORBIDDEN', 'Only merchants and admins can manage devices');
  }
}
