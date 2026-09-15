import { listOrganizations } from '@/domains/merchant/server/service';
import { requireRole } from '@/lib/session';
import { NewDeviceForm } from './new-device-form';

export const dynamic = 'force-dynamic';

export default async function NewDevicePage() {
  await requireRole('ADMIN');
  const organizations = await listOrganizations();
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-xl font-semibold">Create a device</h1>
      <NewDeviceForm organizations={organizations} />
    </div>
  );
}
