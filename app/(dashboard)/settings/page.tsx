import { requireRole } from '@/lib/session';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireRole(['ADMIN', 'MERCHANT']);
  return <SettingsClient name={user.name} email={user.email} role={user.role} />;
}
