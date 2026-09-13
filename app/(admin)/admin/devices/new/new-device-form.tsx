'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminKeys } from '@/domains/admin/api/queries';
import { createDeviceAction } from '@/domains/device/server/actions';
import { useAction } from '@/hooks/use-action';

export function NewDeviceForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [result, setResult] = useState<{ slug: string; claimCode: string } | null>(null);

  const create = useAction(createDeviceAction, {
    successMsg: 'Device created',
    keys: [adminKeys.devices()],
    onSuccess: (res) => setResult({ slug: res.device.slug, claimCode: res.claimCode }),
  });

  if (result) {
    return (
      <div className="mt-6 space-y-4 rounded border p-5" data-testid="new-device-result">
        <h2 className="font-semibold">Device created</h2>
        <p className="text-sm">
          Public URL: <code className="rounded bg-muted px-1">/s/{result.slug}</code>
        </p>
        <p className="text-sm">
          One-time claim code (shown once, distribute with the device):{' '}
          <code className="rounded bg-muted px-1 font-mono text-base">{result.claimCode}</code>
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/devices')}
          className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back to inventory
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(name);
      }}
      className="mt-6 space-y-4"
    >
      <label className="block text-sm">
        Device name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      {create.isError && <p className="text-sm text-red-600">Creation failed</p>}
      <button
        type="submit"
        disabled={create.isPending}
        className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {create.isPending ? 'Creating…' : 'Create device'}
      </button>
    </form>
  );
}
