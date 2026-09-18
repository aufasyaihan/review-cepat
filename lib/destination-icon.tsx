import type { IconType } from 'react-icons';
import { FaFacebook, FaGlobe, FaInstagram, FaLink, FaTiktok, FaWhatsapp } from 'react-icons/fa';

const ICONS: Record<string, IconType> = {
  INSTAGRAM: FaInstagram,
  FACEBOOK: FaFacebook,
  TIKTOK: FaTiktok,
  WHATSAPP: FaWhatsapp,
  WEBSITE: FaGlobe,
  CUSTOM_URL: FaLink,
};

/** Icon for a destination row, by its DestinationType string. Falls back to a generic link icon. */
export function destinationIcon(type: string): IconType {
  return ICONS[type] ?? FaLink;
}
