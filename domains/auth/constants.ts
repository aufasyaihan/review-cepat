export const ROLES = ['ADMIN', 'MERCHANT'] as const;
export type Role = (typeof ROLES)[number];
