'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminKeys, adminQueries } from '@/domains/admin/api/queries';
import { resetDeviceAction, setDeviceDisabledAction } from '@/domains/device/server/actions';
import { useAction } from '@/hooks/use-action';

const STATUS_VALUE: Record<string, string> = {
  UNCLAIMED: 'Unclaimed',
  CLAIMED: 'Claimed',
  PUBLISHED: 'Published',
  UNPUBLISHED: 'Unpublished',
  DISABLED: 'Disabled',
};

export function AdminDevicesClient() {
  const { data: devices } = useSuspenseQuery(adminQueries.devices());
  const [pendingReset, setPendingReset] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Device inventory</h1>
        <Button>
          <a href="/admin/devices/new">+ New device</a>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  <code className="text-xs">/s/{d.slug}</code>
                </TableCell>
                <TableCell>
                  <Badge variant={d.status === 'DISABLED' ? 'destructive' : 'secondary'}>
                    {STATUS_VALUE[d.status] ?? d.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.status === 'UNCLAIMED' ? '—' : 'Claimed'}
                </TableCell>
                <TableCell className="text-right">
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
                            Clears all configuration, the organization binding, and the claim code.
                            Use only for returns or re-inventory.
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
