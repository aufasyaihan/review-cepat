'use client';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deviceMutations } from '@/domains/device/api/mutations';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  UNCLAIMED: { label: 'Unclaimed', tone: 'bg-muted text-muted-foreground' },
  CLAIMED: { label: 'Draft', tone: 'bg-muted text-muted-foreground' },
  PUBLISHED: { label: 'Published', tone: 'bg-emerald-100 text-emerald-800' },
  UNPUBLISHED: { label: 'Unpublished', tone: 'bg-amber-100 text-amber-800' },
  DISABLED: { label: 'Disabled', tone: 'bg-red-100 text-red-800' },
};

export function DevicesClient() {
  const { data: devices } = useSuspenseQuery(deviceQueries.list());
  const queryClient = useQueryClient();
  const router = useRouter();

  async function onPublish(id: string) {
    await deviceMutations.publish(id).mutationFn();
    queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
    router.refresh();
  }

  async function onUnpublish(id: string) {
    await deviceMutations.unpublish(id).mutationFn();
    queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
    router.refresh();
  }

  if (devices.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">No devices yet</h1>
        <p className="mt-2 text-muted-foreground">
          Claim a device with its one-time claim code to get started.
        </p>
        <Link
          href="/devices/claim"
          className="mt-6 inline-block rounded bg-primary px-4 py-2 text-primary-foreground"
        >
          Claim a device
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My devices</h1>
        <Link href="/devices/claim" className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
          + Claim a device
        </Link>
      </div>

      <ul className="divide-y rounded border">
        {devices.map((device) => {
          const badge = STATUS_LABEL[device.status] ?? STATUS_LABEL.UNCLAIMED;
          return (
            <li key={device.id} className="flex flex-wrap items-center gap-3 p-4">
              <Link href={`/devices/${device.id}`} className="font-medium hover:underline">
                {device.name}
              </Link>
              <code className="text-xs text-muted-foreground">/s/{device.slug}</code>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badge.tone}`}>
                {badge.label}
              </span>
              <div className="ml-auto flex gap-2">
                <Link
                  href={`/devices/${device.id}`}
                  className="rounded border px-3 py-1 text-sm hover:bg-muted"
                >
                  Configure
                </Link>
                {device.status === 'PUBLISHED' ? (
                  <button
                    type="button"
                    onClick={() => onUnpublish(device.id)}
                    className="rounded border px-3 py-1 text-sm hover:bg-muted"
                  >
                    Unpublish
                  </button>
                ) : (
                  device.status !== 'DISABLED' && (
                    <button
                      type="button"
                      onClick={() => onPublish(device.id)}
                      className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
                    >
                      Publish
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
