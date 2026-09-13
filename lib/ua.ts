export type ParsedUa = {
  browser: string | null;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
};

/**
 * Best-effort browser/device detection from a User-Agent header (spec FR-013).
 * Deliberately heuristic — analytics fields are reported "when available".
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUa {
  if (!ua) return { browser: null, deviceType: 'unknown' };

  const s = ua.toLowerCase();
  let deviceType: ParsedUa['deviceType'] = 'desktop';
  if (/(tablet|ipad)/.test(s)) deviceType = 'tablet';
  else if (/(mobile|iphone|android.*mobile|windows phone)/.test(s)) deviceType = 'mobile';

  let browser: string | null = null;
  if (s.includes('edg/')) browser = 'Edge';
  else if (s.includes('chrome') && !s.includes('chromium')) browser = 'Chrome';
  else if (s.includes('firefox')) browser = 'Firefox';
  else if (s.includes('safari')) browser = 'Safari';
  else if (s.includes('chromium')) browser = 'Chromium';

  return { browser, deviceType };
}
