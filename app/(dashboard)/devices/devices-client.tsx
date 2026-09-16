'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';
import { publishDeviceAction, unpublishDeviceAction } from '@/domains/device/server/actions';
import type { DeviceSummary } from '@/domains/device/types';
import { useAction } from '@/hooks/use-action';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  UNCLAIMED: { label: 'Unclaimed', tone: 'bg-muted text-muted-foreground' },
  CLAIMED: { label: 'Draft', tone: 'bg-muted text-muted-foreground' },
  PUBLISHED: { label: 'Published', tone: 'bg-emerald-100 text-emerald-800' },
  UNPUBLISHED: { label: 'Unpublished', tone: 'bg-amber-100 text-amber-800' },
  DISABLED: { label: 'Disabled', tone: 'bg-red-100 text-red-800' },
};

export function DevicesClient() {
  const router = useRouter();
  const { data: devices } = useSuspenseQuery(deviceQueries.list());
  const publish = useAction(publishDeviceAction, {
    successMsg: 'Device published',
    keys: [deviceKeys.lists()],
  });
  const unpublish = useAction(unpublishDeviceAction, {
    successMsg: 'Device unpublished',
    keys: [deviceKeys.lists()],
  });

  const columns: ColumnDef<DeviceSummary>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device" />,
      cell: ({ row }) => (
        <Link href={`/devices/${row.original.id}`} className="font-medium hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'slug',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Slug" />,
      cell: ({ row }) => (
        <code className="text-xs text-muted-foreground">/s/{row.original.slug}</code>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const badge = STATUS_LABEL[row.original.status] ?? STATUS_LABEL.UNCLAIMED;
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs ${badge.tone}`}>{badge.label}</span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const device = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/devices/${device.id}`)}
            >
              Configure
            </Button>
            {device.status === 'PUBLISHED' ? (
              <Dialog>
                <DialogTrigger
                  render={<Button variant="outline" size="sm" disabled={unpublish.isPending} />}
                >
                  Unpublish
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Unpublish {device.name}?</DialogTitle>
                    <DialogDescription>
                      Remove this device from the public directory. It stays in your organization.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                    <DialogClose
                      render={
                        <Button
                          variant="destructive"
                          disabled={unpublish.isPending}
                          onClick={() => unpublish.mutate(device.id)}
                        />
                      }
                    >
                      {unpublish.isPending ? 'Unpublishing…' : 'Unpublish'}
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              device.status !== 'DISABLED' && (
                <Dialog>
                  <DialogTrigger render={<Button size="sm" disabled={publish.isPending} />}>
                    Publish
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Publish {device.name}?</DialogTitle>
                      <DialogDescription>
                        Make this device visible to customers in the public directory.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                      <DialogClose
                        render={
                          <Button
                            disabled={publish.isPending}
                            onClick={() => publish.mutate(device.id)}
                          />
                        }
                      >
                        {publish.isPending ? 'Publishing…' : 'Publish'}
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )
            )}
          </div>
        );
      },
    },
  ];

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
    <DataTable
      columns={columns}
      data={devices}
      showRowSelected={false}
      headerContent={
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">My devices</h1>
          <Button
            render={<Link href="/devices/claim" />}
            nativeButton={false}
            variant="outline"
            className="w-fit"
          >
            Claim a device
          </Button>
        </div>
      }
    />
  );
}
