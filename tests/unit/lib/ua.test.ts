import { describe, expect, it } from 'vitest';

import { parseUserAgent } from '@/lib/ua';

describe('lib/ua', () => {
  it('detects Android mobile Chrome', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Chrome', deviceType: 'mobile' });
  });

  it('detects iPhone Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Safari', deviceType: 'mobile' });
  });

  it('detects desktop Firefox', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Firefox', deviceType: 'desktop' });
  });

  it('detects tablet', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile Safari/604.1';
    expect(parseUserAgent(ua).deviceType).toBe('tablet');
  });

  it('handles missing UA', () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, deviceType: 'unknown' });
  });
});
