import type { ProfileInput, ProfileOutput } from '@/domains/merchant/schemas/profile';
import {
  getProfileByUserId,
  listMerchants,
  type MerchantWithDevices,
  upsertProfile,
} from './service';

/**
 * Permission helpers for the merchant domain. Enforces that a user may only
 * read/update their own merchant profile; admins may list all merchants.
 */
export type { MerchantWithDevices, ProfileInput, ProfileOutput };

export { getProfileByUserId, listMerchants, upsertProfile };
