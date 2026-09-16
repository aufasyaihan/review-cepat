'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  UNCLAIMED: { label: 'Unclaimed', tone: 'bg-muted text-muted-foreground' },
  CLAIMED: { label: 'Draft', tone: 'bg-muted text-muted-foreground' },
  PUBLISHED: { label: 'Published', tone: 'bg-emerald-100 text-emerald-800' },
  UNPUBLISHED: { label: 'Unpublished', tone: 'bg-amber-100 text-amber-800' },
  DISABLED: { label: 'Disabled', tone: 'bg-red-100 text-red-800' },
};

export function AdminDevicesClient({
  organizations,
}: {
  organizations: OrganizationWithDevices[];
}) {
  const { data: devices } = useSuspenseQuery(adminQueries.devices());
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingReset, setPendingReset] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const disable = useAction((id: string) => setDeviceDisabledAction(id, true), {
    successMsg: 'Device disabled',
    keys: [adminKeys.devices()],
  });
  const enable = useAction((id: string) => setDeviceDisabledAction(id, false), {
    successMsg: 'Device re-enabled',
    keys: [adminKeys.devices()],
  });
  const reset = useAction((id: string) => resetDeviceAction(id, 'admin'), {
    successMsg: 'Device reset — organization cleared, new claim code issued',
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
      accessorKey: 'state',
      header: ({ column }) => <DataTableColumnHeader column={column} title="State" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.status === 'UNCLAIMED' ? '—' : 'Claimed'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="flex justify-end gap-2">
            {d.status === 'DISABLED' ? (
              <Button size="sm" variant="outline" onClick={() => enable.mutate(d.id)}>
                Re-enable
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => disable.mutate(d.id)}>
                Disable
              </Button>
            )}
            <Dialog
              open={pendingReset === d.id}
              onOpenChange={(open) => setPendingReset(open ? d.id : null)}
            >
              <DialogTrigger
                render={
                  <Button size="sm" variant="destructive">
                    Reset
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset {d.name}?</DialogTitle>
                  <DialogDescription>
                    Clears all configuration, the organization binding, and the claim code. Use only
                    for returns or re-inventory.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPendingReset(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => reset.mutate(d.id)}
                    disabled={reset.isPending}
                  >
                    {reset.isPending ? 'Resetting…' : 'Reset'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={pendingDelete === d.id}
              onOpenChange={(open) => setPendingDelete(open ? d.id : null)}
            >
              <DialogTrigger
                render={
                  <Button size="sm" variant="destructive">
                    Delete
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {d.name}?</DialogTitle>
                  <DialogDescription>
                    Marks the device deleted so it can no longer be claimed or scanned. Its scan
                    history is kept.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPendingDelete(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => del.mutate(d.id)}
                    disabled={del.isPending}
                  >
                    {del.isPending ? 'Deleting…' : 'Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
      },
    },
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
        headerContent={
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">Device inventory</h1>
            <Button className="w-fit" onClick={() => setCreateOpen(true)}>
              New device
            </Button>
          </div>
        }
      />
      <CreateDeviceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizations={organizations}
      />
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
              <Label htmlFor="device-org">Assign to reseller organization (optional)</Label>
              <Select
                value={orgId || 'none'}
                onValueChange={(value: string | null) =>
                  setOrgId(value && value !== 'none' ? value : '')
                }
              >
                <SelectTrigger id="device-org">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No organization — assign later</SelectItem>
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
