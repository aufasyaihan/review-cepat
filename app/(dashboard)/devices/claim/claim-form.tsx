'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deviceKeys } from '@/domains/device/api/queries';
import { claimDeviceAction } from '@/domains/device/server/actions';
import { useAction } from '@/hooks/use-action';

export function ClaimForm() {
  const router = useRouter();
  const claim = useAction(claimDeviceAction, {
    successMsg: 'Device claimed',
    keys: [deviceKeys.lists()],
    onSuccess: (device) => router.push(`/devices/${device.id}`),
  });

  const form = useForm({
    defaultValues: { claimCode: '' },
    onSubmit: ({ value }) => claim.mutate(value.claimCode.toUpperCase()),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Link your device</CardTitle>
        <CardDescription>The claim code is single-use. Keep it private.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="claimCode">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="claimCode">Claim code</Label>
                <Input
                  id="claimCode"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. 8D3F9KA2"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={claim.isPending} className="w-full">
            {claim.isPending ? 'Claiming…' : 'Claim device'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
