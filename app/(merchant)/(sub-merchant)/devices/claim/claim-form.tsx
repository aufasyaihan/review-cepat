'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="mt-6 space-y-4"
    >
      <form.Field name="claimCode">
        {(field) => (
          <label className="block text-sm">
            Claim code
            <input
              required
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="e.g. 8D3F9KA2"
              className="mt-1 w-full rounded border px-3 py-2 font-mono uppercase"
            />
          </label>
        )}
      </form.Field>
      <button
        type="submit"
        disabled={claim.isPending}
        className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {claim.isPending ? 'Claiming…' : 'Claim device'}
      </button>
    </form>
  );
}
