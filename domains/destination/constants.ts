export const DESTINATION_TYPES = [
  'GOOGLE_REVIEW',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'WHATSAPP',
  'WEBSITE',
  'CUSTOM_URL',
] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const MAX_DESTINATIONS = 12;

/** Canonical Google review URL derived from a place id (spec FR-009). */
export function deriveReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
