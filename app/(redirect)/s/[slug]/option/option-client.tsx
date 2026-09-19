'use client';

import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { claimForSelfAction, resellDeviceAction } from '@/domains/device/server/option-actions';

type Choice = 'claim' | 'resell' | null;

export function OptionClient({ deviceId, token }: { deviceId: string; token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Choice>(null);
  const [isPending, setIsPending] = useState(false);

  async function confirm() {
    setIsPending(true);
    if (pending === 'claim') {
      const result = await claimForSelfAction(deviceId, token);
      setIsPending(false);
      setPending(null);
      if (!result.ok) return toast.error(result.error);
      toast.success('Device claimed');
      router.push(result.data.redirectUrl);
      return;
    }
    if (pending === 'resell') {
      const result = await resellDeviceAction(deviceId, token);
      setIsPending(false);
      setPending(null);
      if (!result.ok) return toast.error(result.error);
      toast.success('Device reset for resale', {
        description: `New code: ${result.data.claimCode}`,
      });
      router.push('/dashboard');
    }
  }

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claim for yourself</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Add this device to your own merchant and manage it from your dashboard.
          </p>
          <Button className="w-full" onClick={() => setPending('claim')}>
            Claim for yourself
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resell</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Keep this device unclaimed with a fresh code so you can sell it to a merchant.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setPending('resell')}>
            Resell
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === 'claim' ? 'Claim this device?' : 'Resell this device?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === 'claim'
                ? 'This device will be added to your merchant.'
                : 'Any existing links on this device will be cleared and a new claim code issued.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancel</AlertDialogCancel>
            <Button disabled={isPending} onClick={confirm}>
              {isPending ? '…' : 'Confirm'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
