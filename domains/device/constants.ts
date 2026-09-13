export const DEVICE_STATUS = [
  'UNCLAIMED',
  'CLAIMED',
  'PUBLISHED',
  'UNPUBLISHED',
  'DISABLED',
] as const;
export type DeviceStatus = (typeof DEVICE_STATUS)[number];

export const SLUG_MIN = 6;
export const SLUG_MAX = 32;
export const CLAIM_CODE_PATTERN = /^[A-Z0-9]{6,16}$/i;
