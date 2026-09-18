'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deviceKeys } from '@/domains/device/api/queries';
import { renameDeviceAction } from '@/domains/device/server/actions';
import type { DeviceSummary } from '@/domains/device/types';
import { useAction } from '@/hooks/use-action';

export function EditDeviceDialog({
  device,
  scope,
  listKeys,
  onOpenChange,
}: {
  device: DeviceSummary;
  scope: 'admin' | 'owner';
  listKeys: readonly (readonly unknown[])[];
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(device.name);

  const rename = useAction(
    (args: { id: string; name: string }) => renameDeviceAction(args.id, args.name, scope),
    {
      successMsg: 'Device renamed',
      keys: [...listKeys, deviceKeys.detail(device.id)],
      onSuccess: () => onOpenChange(false),
    },
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate({ id: device.id, name });
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {device.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-device-name">Device name</Label>
            <Input
              id="edit-device-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
