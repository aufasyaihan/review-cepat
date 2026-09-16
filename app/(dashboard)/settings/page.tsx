import { requireRole } from '@/lib/session';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireRole(['ADMIN', 'MERCHANT']);
  return <SettingsClient />;
}
