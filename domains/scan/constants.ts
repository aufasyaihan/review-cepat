export const SCAN_OUTCOMES = ['REDIRECTED', 'LANDING_SHOWN', 'INACTIVE', 'NOT_FOUND'] as const;
export type ScanOutcome = (typeof SCAN_OUTCOMES)[number];

export const SCAN_SOURCES = ['nfc', 'qr', 'link'] as const;
export type ScanSource = (typeof SCAN_SOURCES)[number];
