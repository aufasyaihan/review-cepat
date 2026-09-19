'use client';

import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createActionsColumn } from '@/components/ui/data-table/actions-column';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import { DataTableSkeleton } from '@/components/ui/data-table/data-table-skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';
import {
  forgetDeviceAction,
  publishDeviceAction,
  resetDeviceAction,
  unpublishDeviceAction,
} from '@/domains/device/server/actions';
import type { DeviceSummary } from '@/domains/device/types';
import { useAction } from '@/hooks/use-action';
import { EditDeviceDialog } from './edit-device-dialog';

export function DevicesClient({ isOwner }: { isOwner: boolean }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isPending } = useQuery(deviceQueries.paginatedList({ q: debouncedQ, page, limit }));
  const devices = data?.rows ?? [];
  const total = data?.total ?? 0;

  const [pendingPub, setPendingPub] = useState<{
    device: DeviceSummary;
    action: 'publish' | 'unpublish';
  } | null>(null);
  const [pendingReset, setPendingReset] = useState<DeviceSummary | null>(null);
  const [pendingForget, setPendingForget] = useState<DeviceSummary | null>(null);
  const [pendingEdit, setPendingEdit] = useState<DeviceSummary | null>(null);
  const publish = useAction(publishDeviceAction, {
    successMsg: 'Device published',
    keys: [deviceKeys.lists()],
    onSuccess: () => setPendingPub(null),
  });
  const unpublish = useAction(unpublishDeviceAction, {
    successMsg: 'Device unpublished',
    keys: [deviceKeys.lists()],
    onSuccess: () => setPendingPub(null),
  });
  const reset = useAction((id: string) => resetDeviceAction(id, 'owner'), {
    successMsg: 'Device reset — a new claim code was issued',
    keys: [deviceKeys.lists()],
    onSuccess: () => setPendingReset(null),
  });
  const forget = useAction((id: string) => forgetDeviceAction(id), {
    successMsg: 'Device forgotten — it is now unclaimed',
    keys: [deviceKeys.lists()],
    onSuccess: () => setPendingForget(null),
  });

  const columns: ColumnDef<DeviceSummary>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'slug',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Slug" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <code className="text-xs text-muted-foreground">/s/{row.original.slug}</code>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/s/${row.original.slug}`);
              toast.success('Link copied', { description: `/s/${row.original.slug}` });
            }}
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const variantMap: Record<
          string,
          'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info'
        > = {
          UNCLAIMED: 'secondary',
          CLAIMED: 'info',
          PUBLISHED: 'success',
          UNPUBLISHED: 'warning',
          DISABLED: 'destructive',
        };
        return (
          <Badge variant={variantMap[row.original.status] ?? 'secondary'}>
            {row.original.status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    createActionsColumn<DeviceSummary>((device) => [
      { label: 'Edit', onClick: () => setPendingEdit(device) },
      ...(device.status === 'PUBLISHED'
        ? [{ label: 'Unpublish', onClick: () => setPendingPub({ device, action: 'unpublish' }) }]
        : device.status !== 'DISABLED'
          ? [{ label: 'Publish', onClick: () => setPendingPub({ device, action: 'publish' }) }]
          : []),
      ...(isOwner
        ? [
            { label: 'Reset', onClick: () => setPendingReset(device) },
            {
              label: 'Forgot device',
              variant: 'destructive' as const,
              onClick: () => setPendingForget(device),
            },
          ]
        : []),
    ]),
  ];

  if (isPending && !data) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="text-xl font-semibold">My devices</h1>
        <DataTableSkeleton columnCount={5} rowCount={5} />
      </div>
    );
  }

  if (total === 0 && !debouncedQ) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">No devices yet</h1>
        <p className="mt-2 text-muted-foreground">
          Scan or open your device's link to activate it — it will show up here once claimed.
        </p>
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={devices}
        showRowSelected={false}
        manualPagination
        pageCount={Math.max(1, Math.ceil(total / limit))}
        pagination={{ pageIndex: page - 1, pageSize: limit }}
        onPaginationChange={(updater) => {
          const next =
            typeof updater === 'function'
              ? updater({ pageIndex: page - 1, pageSize: limit })
              : updater;
          setPage(next.pageIndex + 1);
          setLimit(next.pageSize);
        }}
        headerContent={<h1 className="text-xl font-semibold">My devices</h1>}
        toolbar={
          <Input
            aria-label="Search devices…"
            placeholder="Search devices…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-56"
          />
        }
      />
      <Dialog open={pendingPub !== null} onOpenChange={(open) => !open && setPendingPub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingPub?.action === 'publish' ? 'Publish' : 'Unpublish'} {pendingPub?.device.name}
              ?
            </DialogTitle>
            <DialogDescription>
              {pendingPub?.action === 'publish'
                ? 'Make this device visible to customers in the public directory.'
                : 'Remove this device from the public directory. It stays in your merchant.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <DialogClose
              render={
                <Button
                  variant={pendingPub?.action === 'unpublish' ? 'destructive' : 'default'}
                  disabled={publish.isPending || unpublish.isPending}
                  onClick={() => {
                    if (!pendingPub) return;
                    if (pendingPub.action === 'publish') publish.mutate(pendingPub.device.id);
                    else unpublish.mutate(pendingPub.device.id);
                  }}
                />
              }
            >
              {publish.isPending || unpublish.isPending
                ? '…'
                : pendingPub?.action === 'publish'
                  ? 'Publish'
                  : 'Unpublish'}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={pendingReset !== null}
        onOpenChange={(open) => setPendingReset(open ? pendingReset : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {pendingReset?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Clears all configuration and issues a new claim code for this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={reset.isPending}
              onClick={() => pendingReset && reset.mutate(pendingReset.id)}
            >
              {reset.isPending ? 'Resetting…' : 'Reset'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingForget !== null}
        onOpenChange={(open) => setPendingForget(open ? pendingForget : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget {pendingForget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Detaches this device from your merchant, clears its links, and issues a new claim code
              for its next owner. This cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={forget.isPending}
              onClick={() => pendingForget && forget.mutate(pendingForget.id)}
            >
              {forget.isPending ? 'Forgetting…' : 'Forget device'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {pendingEdit && (
        <EditDeviceDialog
          device={pendingEdit}
          scope="owner"
          listKeys={[deviceKeys.lists()]}
          onOpenChange={(open) => !open && setPendingEdit(null)}
        />
      )}
    </>
  );
}
