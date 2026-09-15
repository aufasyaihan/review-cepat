import { z } from 'zod';

import { DESTINATION_TYPES, MAX_DESTINATIONS } from '@/domains/destination/constants';

export const destinationInputSchema = z
  .object({
    type: z.enum(DESTINATION_TYPES),
    label: z.string().trim().max(120, 'Label max 120 chars').optional(),
    url: z
      .string()
      .trim()
      .max(300, 'URL max 300 chars')
      .url('Must be a valid absolute URL')
      .optional(),
    placeId: z.string().trim().min(1).optional(),
    position: z.number().int().min(0),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'GOOGLE_REVIEW' && !value.placeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['placeId'],
        message: 'Google review destinations require a selected place',
      });
    }
    if (value.type !== 'GOOGLE_REVIEW' && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'A valid destination URL is required',
      });
    }
  });

export const setDestinationsSchema = z
  .object({
    destinations: z
      .array(destinationInputSchema)
      .min(1, 'At least one destination is required')
      .max(MAX_DESTINATIONS, `Maximum ${MAX_DESTINATIONS} destinations`),
  })
  .superRefine((value, ctx) => {
    const positions = value.destinations.map((d) => d.position);
    const unique = new Set(positions);
    if (unique.size !== positions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinations'],
        message: 'Destination positions must be unique and contiguous from 0',
      });
    }
  });

export type DestinationInput = z.infer<typeof destinationInputSchema>;
export type SetDestinationsInput = z.infer<typeof setDestinationsSchema>;
