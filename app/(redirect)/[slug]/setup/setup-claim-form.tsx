'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupClaimCodeAction } from '@/domains/device/server/setup-actions';
import { useAction } from '@/hooks/use-action';

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
            <Input
              id="claim-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ABCD1234"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button
            type="submit"
            disabled={submit.isPending || code.trim().length === 0}
            className="w-full"
          >
            {submit.isPending ? 'Checking…' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
