import { FaFacebook, FaGlobe, FaInstagram, FaLink, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import { describe, expect, it } from 'vitest';
import { destinationIcon } from '@/lib/destination-icon';

describe('destinationIcon', () => {
  it.each([
    ['INSTAGRAM', FaInstagram],
    ['FACEBOOK', FaFacebook],
    ['TIKTOK', FaTiktok],
    ['WHATSAPP', FaWhatsapp],
    ['WEBSITE', FaGlobe],
    ['CUSTOM_URL', FaLink],
    ['SOMETHING_UNKNOWN', FaLink],
  ])('maps %s to the right icon', (type, expected) => {
    expect(destinationIcon(type)).toBe(expected);
  });
});
