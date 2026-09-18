'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { setupClaimCodeAction } from '@/domains/device/server/setup-actions';
import { useAction } from '@/hooks/use-action';

const CLAIM_CODE_LENGTH = 8;

export function SetupClaimForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');

  const submit = useAction((input: unknown) => setupClaimCodeAction(slug, input), {
    successMsg: 'Claim code accepted',
    onSuccess: (data) => router.replace(data.redirectUrl),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Claim code</CardTitle>
        <CardDescription>Enter the code printed with your device to begin setup.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate({ claimCode: code });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="claim-code">Claim code</Label>
            <InputOTP
              id="claim-code"
              maxLength={CLAIM_CODE_LENGTH}
              value={code}
              onChange={(value) => setCode(value.toUpperCase())}
              autoComplete="off"
            >
              <InputOTPGroup>
                {Array.from({ length: CLAIM_CODE_LENGTH }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length slot layout, index is position identity
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            type="submit"
            disabled={submit.isPending || code.length !== CLAIM_CODE_LENGTH}
            className="w-full"
          >
            {submit.isPending ? 'Checking…' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
