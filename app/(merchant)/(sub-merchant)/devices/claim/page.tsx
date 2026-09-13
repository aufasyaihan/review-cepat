'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { deviceMutations } from '@/domains/device/api/mutations';
import { deviceKeys } from '@/domains/device/api/queries';

export default function ClaimPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [claimCode, setClaimCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const device = await deviceMutations.claim().mutationFn(claimCode.toUpperCase());
      queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
      router.push(`/devices/${device.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-xl font-semibold">Claim a device</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Claim code
          <input
            required
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            placeholder="e.g. 8D3F9KA2"
            className="mt-1 w-full rounded border px-3 py-2 font-mono uppercase"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? 'Claiming…' : 'Claim device'}
        </button>
      </form>
    </div>
  );
}
