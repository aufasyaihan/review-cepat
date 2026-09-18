'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';
import { resetDeviceAction, unpublishDeviceAction } from '@/domains/device/server/actions';
import { assignDeviceAction } from '@/domains/merchant/server/member-actions';
import type { MemberWithUser } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';

export function SettingsClient({
  deviceId,
  isOwner,
  members,
}: {
  deviceId: string;
  isOwner: boolean;
  members: MemberWithUser[];
}) {
  const router = useRouter();
  const { data: device } = useSuspenseQuery(deviceQueries.detail(deviceId));
  const keys = [deviceKeys.detail(deviceId), deviceKeys.lists()];
  const [pendingAssign, setPendingAssign] = useState<MemberWithUser | null>(null);

  const assign = useAction(
    (args: { deviceId: string; memberId: string }) =>
      assignDeviceAction(args.deviceId, args.memberId),
    { successMsg: 'Device assigned', keys },
  );
  const unpublish = useAction(unpublishDeviceAction, {
    successMsg: 'Device unpublished',
    keys,
  });
  const reset = useAction((scope: 'owner') => resetDeviceAction(deviceId, scope), {
    successMsg: 'Device reset — a new claim code was issued',
    keys,
    onSuccess: () => router.push('/devices'),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Settings — {device.name}</h1>
        <p className="text-sm text-muted-foreground">
          Public URL: <span className="underline">/s/{device.slug}</span>
        </p>
      </header>
      <Separator />

      {isOwner && !device.memberId && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Assign to member</h2>
            <p className="text-sm text-muted-foreground">
              Assign this device to a sub-merchant so they can manage it.
            </p>
          </div>
          <Select
            items={members.map((m) => ({ value: m.id, label: `${m.name} — ${m.email}` }))}
            value={null}
            onValueChange={(value: string | null) => {
              if (!value) return;
              const member = members.find((m) => m.id === value);
              if (member) setPendingAssign(member);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} — {m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog
            open={pendingAssign !== null}
            onOpenChange={(open) => {
              if (!open) setPendingAssign(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Assign {device.name} to {pendingAssign?.name}?
                </DialogTitle>
                <DialogDescription>
                  {pendingAssign?.name} will be able to manage and configure this device.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button
                  disabled={assign.isPending}
                  onClick={() => {
                    if (!pendingAssign) return;
                    assign.mutate({ deviceId, memberId: pendingAssign.id });
                  }}
                >
                  {assign.isPending ? 'Assigning…' : 'Assign'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      )}

      {device.status === 'PUBLISHED' && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Unpublish</h2>
            <p className="text-sm text-muted-foreground">
              Remove this device from the public directory. It stays in your merchant.
            </p>
          </div>
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" disabled={unpublish.isPending}>
                  {unpublish.isPending ? 'Unpublishing…' : 'Unpublish device'}
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Unpublish {device.name}?</DialogTitle>
                <DialogDescription>
                  Remove this device from the public directory. It stays in your merchant.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <DialogClose
                  render={
                    <Button
                      variant="destructive"
                      disabled={unpublish.isPending}
                      onClick={() => unpublish.mutate(deviceId)}
                    />
                  }
                >
                  {unpublish.isPending ? 'Unpublishing…' : 'Unpublish device'}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      )}

      {isOwner && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Reset device</CardTitle>
            <CardDescription>
              Clears destinations and the sub-merchant assignment, keeps this device in your
              merchant, and issues a fresh claim code. The device must be set up again (FR-028).
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                Reset device
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset this device?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This clears all destinations and the member assignment, and issues a new claim
                    code. The device must be set up again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel render={<Button variant="outline" />}>
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={reset.isPending}
                    onClick={() => reset.mutate('owner')}
                  >
                    {reset.isPending ? 'Resetting…' : 'Reset device'}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      )}
      <Separator />
    </div>
  );
}
