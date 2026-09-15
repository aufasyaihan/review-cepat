'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';
import { resetDeviceAction } from '@/domains/device/server/actions';
import { useAction } from '@/hooks/use-action';

/** Owner-only device settings: reset keeps the organization and rotates the claim code. */
export function SettingsClient({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const { data: device } = useSuspenseQuery(deviceQueries.detail(deviceId));

  const reset = useAction((scope: 'owner') => resetDeviceAction(deviceId, scope), {
    successMsg: 'Device reset — a new claim code was issued',
    keys: [deviceKeys.detail(deviceId), deviceKeys.lists()],
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

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Reset device</CardTitle>
          <CardDescription>
            Clears destinations and the sub-merchant assignment, keeps this device in your
            organization, and issues a fresh claim code. The device must be set up again (FR-028).
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end">
          <Button
            variant="destructive"
            disabled={reset.isPending}
            onClick={() => reset.mutate('owner')}
          >
            {reset.isPending ? 'Resetting…' : 'Reset device'}
          </Button>
        </CardFooter>
      </Card>
      <Separator />
    </div>
  );
}
