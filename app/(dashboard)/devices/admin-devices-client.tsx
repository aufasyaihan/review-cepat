'use client';

import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminKeys, adminQueries } from '@/domains/admin/api/queries';
import {
  createDeviceAction,
  deleteDeviceAction,
  resetDeviceAction,
  setDeviceDisabledAction,
} from '@/domains/device/server/actions';
import type { DeviceSummary } from '@/domains/device/types';
import type { OrganizationWithDevices } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';
import useCopy from '@/hooks/use-copy';
import { EditDeviceDialog } from './edit-device-dialog';

export function AdminDevicesClient({
  organizations,
}: {
  organizations: OrganizationWithDevices[];
}) {
  const baseUrl = useMemo(
    () =>
      typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '',
    [],
  );
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isPending } = useQuery(
    adminQueries.paginatedDevices({ q: debouncedQ, page, limit }),
  );
  const devices = data?.rows ?? [];
  const total = data?.total ?? 0;

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<DeviceSummary | null>(null);
  const [pendingReset, setPendingReset] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);
  const { copiedText, isCopied, copyToClipboard } = useCopy();

  const disable = useAction((id: string) => setDeviceDisabledAction(id, true), {
    successMsg: 'Device disabled',
    keys: [adminKeys.devices()],
  });
  const enable = useAction((id: string) => setDeviceDisabledAction(id, false), {
    successMsg: 'Device re-enabled',
    keys: [adminKeys.devices()],
  });
  const reset = useAction((id: string) => resetDeviceAction(id, 'admin'), {
    successMsg: 'Device reset — merchant cleared, new claim code issued',
    keys: [adminKeys.devices(), adminKeys.organizations()],
    onSuccess: () => setPendingReset(null),
  });
  const del = useAction((id: string) => deleteDeviceAction(id), {
    successMsg: 'Device deleted',
    keys: [adminKeys.devices()],
    onSuccess: () => setPendingDelete(null),
  });

  const columns: ColumnDef<DeviceSummary>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'slug',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Url" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <code className="text-xs text-muted-foreground">
            {baseUrl}/s/{row.original.slug}
          </code>
          <Button
            type="button"
            variant="ghost"
            onClick={() => copyToClipboard(`${baseUrl}/s/${row.original.slug}`)}
          >
            {copiedText === `${baseUrl}/s/${row.original.slug}` ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
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
      accessorKey: 'state',
      header: ({ column }) => <DataTableColumnHeader column={column} title="State" />,
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'UNCLAIMED' ? 'secondary' : 'info'}>
          {row.original.status === 'UNCLAIMED' ? 'Unclaimed' : 'Claimed'}
        </Badge>
      ),
    },
    createActionsColumn<DeviceSummary>((d) => [
      { label: 'Edit', onClick: () => setPendingEdit(d) },
      {
        label: d.status === 'DISABLED' ? 'Re-enable' : 'Disable',
        onClick: () => setPendingDisable(d.id),
      },
      { label: 'Reset', onClick: () => setPendingReset(d.id) },
      {
        label: 'Delete',
        variant: 'destructive',
        onClick: () => setPendingDelete(d.id),
      },
    ]),
  ];

  if (isPending && !data) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="text-xl font-semibold">Device inventory</h1>
        <DataTableSkeleton columnCount={5} rowCount={5} />
      </div>
    );
  }

  if (total === 0 && !debouncedQ) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Device inventory</h1>
          <Button onClick={() => setCreateOpen(true)}>New device</Button>
        </div>
        <div className="mt-8 rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">No devices yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a device to generate its one-time claim code.
          </p>
        </div>
        <CreateDeviceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizations={organizations}
        />
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
        headerContent={<h1 className="text-xl font-semibold">Device inventory</h1>}
        actions={<Button onClick={() => setCreateOpen(true)}>New device</Button>}
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
      <AlertDialog
        open={pendingReset !== null}
        onOpenChange={(open) => setPendingReset(open ? pendingReset : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset device?</AlertDialogTitle>
            <AlertDialogDescription>
              Clears all configuration, the merchant binding, and the claim code. Use only for
              returns or re-inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={(props) => (
                <Button variant="outline" {...props}>
                  Cancel
                </Button>
              )}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => pendingReset && reset.mutate(pendingReset)}
              disabled={reset.isPending}
            >
              {reset.isPending ? 'Resetting…' : 'Reset'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => setPendingDelete(open ? pendingDelete : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete device?</AlertDialogTitle>
            <AlertDialogDescription>
              Marks the device deleted so it can no longer be claimed or scanned. Its scan history
              is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={(props) => (
                <Button variant="outline" {...props}>
                  Cancel
                </Button>
              )}
            ></AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && del.mutate(pendingDelete)}
              disabled={del.isPending}
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingDisable !== null}
        onOpenChange={(open) => setPendingDisable(open ? pendingDisable : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDisable && devices.find((d) => d.id === pendingDisable)?.status === 'DISABLED'
                ? 'Re-enable device?'
                : 'Disable device?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDisable && devices.find((d) => d.id === pendingDisable)?.status === 'DISABLED'
                ? 'This will re-enable the device so it can be claimed and scanned again.'
                : 'This will disable the device so it can no longer be claimed or scanned.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={(props) => (
                <Button variant="outline" {...props}>
                  Cancel
                </Button>
              )}
            ></AlertDialogCancel>
            <Button
              variant={
                devices.find((d) => d.id === pendingDisable)?.status === 'DISABLED'
                  ? 'default'
                  : 'destructive'
              }
              onClick={() => {
                if (!pendingDisable) return;
                const device = devices.find((d) => d.id === pendingDisable);
                if (!device) return;
                if (device.status === 'DISABLED') enable.mutate(pendingDisable);
                else disable.mutate(pendingDisable);
                setPendingDisable(null);
              }}
              disabled={disable.isPending || enable.isPending}
            >
              {disable.isPending || enable.isPending
                ? '…'
                : pendingDisable &&
                    devices.find((d) => d.id === pendingDisable)?.status === 'DISABLED'
                  ? 'Re-enable'
                  : 'Disable'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CreateDeviceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizations={organizations}
      />
      {pendingEdit && (
        <EditDeviceDialog
          device={pendingEdit}
          scope="admin"
          listKeys={[adminKeys.devices()]}
          onOpenChange={(open) => !open && setPendingEdit(null)}
        />
      )}
    </>
  );
}

function CreateDeviceDialog({
  open,
  onOpenChange,
  organizations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: OrganizationWithDevices[];
}) {
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [result, setResult] = useState<{
    slug: string;
    claimCode: string;
  } | null>(null);
  const urlCopy = useCopy();
  const claimCodeCopy = useCopy();
  const baseUrl = useMemo(
    () =>
      typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '',
    [],
  );

  const create = useAction(
    (args: { name: string; organizationId?: string }) =>
      createDeviceAction(args.name, args.organizationId),
    {
      successMsg: 'Device created',
      keys: [adminKeys.devices(), adminKeys.organizations()],
      onSuccess: (res) => setResult({ slug: res.device.slug, claimCode: res.claimCode }),
    },
  );

  const resetState = () => {
    setResult(null);
    setName('');
    setOrgId('');
    urlCopy.resetHasCopied();
    claimCodeCopy.resetHasCopied();
  };

  const handleOpenChange = (
    next: boolean,
    eventDetails?: { reason?: string; cancel: () => void },
  ) => {
    if (!next) {
      if (result && eventDetails && eventDetails.reason !== 'close-press') {
        eventDetails.cancel();
        return;
      }
      resetState();
    }
    onOpenChange(next);
  };

  const handleDone = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!result}>
        {result ? (
          <div className="mt-2 space-y-4" data-testid="new-device-result">
            <DialogHeader>
              <DialogTitle>Device created</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 text-sm">
              <p>Device URL</p>
              <span className="relative">
                <Input disabled value={baseUrl + '/s/' + result.slug} className="w-full pr-10" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-1 my-auto"
                  onClick={() => urlCopy.copyToClipboard(baseUrl + '/s/' + result.slug)}
                  disabled={urlCopy.isCopied}
                >
                  {urlCopy.isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </span>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p>One-time claim code (shown once, distribute with the device)</p>
              <span className="relative">
                <Input disabled value={result.claimCode} className="w-full pr-10" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-1 my-auto"
                  onClick={() => claimCodeCopy.copyToClipboard(result.claimCode)}
                  disabled={claimCodeCopy.isCopied}
                >
                  {claimCodeCopy.isCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </span>
            </div>
            <DialogFooter>
              <Button onClick={handleDone} disabled={!claimCodeCopy.hasCopied}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ name, organizationId: orgId || undefined });
            }}
          >
            <DialogHeader>
              <DialogTitle>New device</DialogTitle>
              <DialogDescription>
                Generates a unique slug and a one-time claim code.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="device-name">Device name</Label>
              <Input
                id="device-name"
                required
                placeholder="POS Counter"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-org">Assign to reseller merchant (optional)</Label>
              <Select
                items={[
                  { value: 'none', label: 'No merchant — assign later' },
                  ...organizations.map((o) => ({
                    value: o.id,
                    label: `${o.name} (${o.deviceCount} device${o.deviceCount === 1 ? '' : 's'})`,
                  })),
                ]}
                value={orgId || 'none'}
                onValueChange={(value: string | null) =>
                  setOrgId(value && value !== 'none' ? value : '')
                }
              >
                <SelectTrigger id="device-org" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No merchant — assign later</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.deviceCount} device
                      {o.deviceCount === 1 ? '' : 's'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create device'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
