import { z } from 'zod';

const optionalEmpty = z
  .string()
  .transform((v) => v.trim() || undefined)
  .optional();

export const profileSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Business name is required')
    .max(120, 'Business name max 120 chars'),
  phone: optionalEmpty.transform((v) => (v ? v.slice(0, 30) : undefined)),
  country: optionalEmpty.refine((v) => !v || /^[A-Za-z]{2}$/.test(v), {
    message: 'Country must be an ISO-3166 alpha-2 code',
  }),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileOutput = {
  id: number;
  userId: string;
  businessName: string;
  phone: string | null;
  country: string | null;
};
