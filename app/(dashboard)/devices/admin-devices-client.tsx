'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy } from 'lucide-react';
import { useState } from 'react';
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
import { EditDeviceDialog } from './edit-device-dialog';

export function AdminDevicesClient({
  organizations,
}: {
  organizations: OrganizationWithDevices[];
}) {
  const { data: devices } = useSuspenseQuery(adminQueries.devices());
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<DeviceSummary | null>(null);
  const [pendingReset, setPendingReset] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);

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
      { label: 'Delete', variant: 'destructive', onClick: () => setPendingDelete(d.id) },
    ]),
  ];

  if (devices.length === 0) {
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
        headerContent={<h1 className="text-xl font-semibold">Device inventory</h1>}
        actions={<Button onClick={() => setCreateOpen(true)}>New device</Button>}
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
  const [result, setResult] = useState<{ slug: string; claimCode: string } | null>(null);

  const create = useAction(
    (args: { name: string; organizationId?: string }) =>
      createDeviceAction(args.name, args.organizationId),
    {
      successMsg: 'Device created',
      keys: [adminKeys.devices(), adminKeys.organizations()],
      onSuccess: (res) => setResult({ slug: res.device.slug, claimCode: res.claimCode }),
    },
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setResult(null);
          setName('');
          setOrgId('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {result ? (
          <div className="mt-2 space-y-4" data-testid="new-device-result">
            <DialogHeader>
              <DialogTitle>Device created</DialogTitle>
              <DialogDescription>
                Public URL: <code className="rounded bg-muted px-1">/s/{result.slug}</code>
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              One-time claim code (shown once, distribute with the device):{' '}
              <code className="rounded bg-muted px-1 font-mono text-base">{result.claimCode}</code>
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
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
                      {o.name} ({o.deviceCount} device{o.deviceCount === 1 ? '' : 's'})
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
