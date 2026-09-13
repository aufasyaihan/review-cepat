'use client';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { adminKeys, adminMutations, adminQueries } from '@/domains/admin/api/queries';

const STATUS_LABEL: Record<string, string> = {
  UNCLAIMED: 'Unclaimed',
  CLAIMED: 'Claimed',
  PUBLISHED: 'Published',
  UNPUBLISHED: 'Unpublished',
  DISABLED: 'Disabled',
};

export function AdminDevicesClient() {
  const { data: devices } = useSuspenseQuery(adminQueries.devices());
  const queryClient = useQueryClient();

  async function setDisabled(id: string, disabled: boolean) {
    const mutation = disabled ? adminMutations.disable(id) : adminMutations.enable(id);
    await mutation.mutationFn();
    queryClient.invalidateQueries({ queryKey: adminKeys.devices() });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Device inventory</h1>
        <Link
          href="/admin/devices/new"
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          + New device
        </Link>
      </div>

      <table className="w-full rounded border text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="p-3">Name</th>
            <th className="p-3">Slug</th>
            <th className="p-3">Status</th>
            <th className="p-3">Owner</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id} className="border-b last:border-0">
              <td className="p-3 font-medium">{d.name}</td>
              <td className="p-3">
                <code className="text-xs">/s/{d.slug}</code>
              </td>
              <td className="p-3">{STATUS_LABEL[d.status] ?? d.status}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {d.status === 'UNCLAIMED' ? '—' : d.id}
              </td>
              <td className="p-3">
                {d.status === 'DISABLED' ? (
                  <button
                    type="button"
                    onClick={() => setDisabled(d.id, false)}
                    className="rounded border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Re-enable
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDisabled(d.id, true)}
                    className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-muted"
                  >
                    Disable
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
