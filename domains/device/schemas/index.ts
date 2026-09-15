import { z } from 'zod';

import { CLAIM_CODE_PATTERN, SLUG_MIN } from '@/domains/device/constants';

export const createDeviceSchema = z.object({
  name: z.string().trim().min(1, 'Device name is required').max(120, 'Device name max 120 chars'),
  organizationId: z.string().trim().min(1).optional(),
});

export const claimDeviceSchema = z.object({
  claimCode: z
    .string()
    .trim()
    .min(SLUG_MIN)
    .max(16)
    .regex(CLAIM_CODE_PATTERN, 'Invalid claim code format'),
});

export const setupClaimCodeSchema = z.object({
  claimCode: z
    .string()
    .trim()
    .min(SLUG_MIN)
    .max(16)
    .regex(CLAIM_CODE_PATTERN, 'Invalid claim code format'),
});

export const transferDeviceSchema = z.object({
  toMerchantId: z.number().int().positive(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type ClaimDeviceInput = z.infer<typeof claimDeviceSchema>;
export type SetupClaimCodeInput = z.infer<typeof setupClaimCodeSchema>;
export type TransferDeviceInput = z.infer<typeof transferDeviceSchema>;
