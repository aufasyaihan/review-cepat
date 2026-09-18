'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DestinationRow, type DestinationRowValue } from '@/components/forms/destination-editor';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { saveSetupDestinationsAction } from '@/domains/destination/server/setup-actions';
import { useAction } from '@/hooks/use-action';

export function SetupRedirectClient({
  deviceId,
  token,
  deviceName,
}: {
  deviceId: string;
  token: string;
  deviceName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [rows, setRows] = useState<DestinationRowValue[]>([
    { type: 'GOOGLE_REVIEW', label: '', url: '', placeId: '' },
  ]);

  const save = useAction(
    (destinations: typeof rows) =>
      saveSetupDestinationsAction(deviceId, token, {
        destinations: destinations.map((r, position) => ({
          type: r.type,
          label: r.label || undefined,
          url: r.url || undefined,
          placeId: r.placeId || undefined,
          position,
          active: true,
        })),
      }),
    {
      successMsg: 'Device set up',
      onSuccess: (data) => router.replace(`/s/${data.slug}`),
    },
  );

  const update = (i: number, patch: Partial<DestinationRowValue>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const setRowFromPlace = (i: number, place: { googlePlaceId: string; name: string }) =>
    update(i, { type: 'GOOGLE_REVIEW', placeId: place.googlePlaceId, label: place.name });

  const canSave = rows.some((r) => r.placeId || r.url);
  const ready = mode === 'single' ? rows.length === 1 && !!rows[0].placeId : canSave;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <h1 className="text-xl font-semibold">Configure {deviceName}</h1>
        <p className="text-sm text-muted-foreground">Choose what customers reach when they scan.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2" role="tablist" aria-label="Destination type">
          {(['single', 'multi'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setRows(
                  m === 'single'
                    ? [{ type: 'GOOGLE_REVIEW', label: '', url: '', placeId: '' }]
                    : [{ type: 'WEBSITE', label: '', url: '', placeId: '' }],
                );
              }}
              className={`rounded border px-4 py-2 text-sm ${
                mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {m === 'single' ? 'Single link' : 'Multiple links'}
            </button>
          ))}
        </div>

        {mode === 'single' ? (
          <div className="space-y-3 rounded border p-5">
            <p className="text-sm text-muted-foreground">
              Single link: pick a business on Google — customers are redirected straight to its
              review page.
            </p>
            {rows.length > 0 && (
              <DestinationRow
                // biome-ignore lint/suspicious/noArrayIndexKey: single row, index is position identity
                key={0}
                index={0}
                row={rows[0]!}
                onUpdate={(patch) => update(0, patch)}
                onPlace={(place) => setRowFromPlace(0, place)}
                onRemove={() => setRows([])}
                canRemove={false}
              />
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded border p-5">
            {rows.map((row, i) => (
              <DestinationRow
                // biome-ignore lint/suspicious/noArrayIndexKey: editable unsaved rows, index is position identity until saved
                key={i}
                index={i}
                row={row}
                onUpdate={(patch) => update(i, patch)}
                onPlace={(place) => setRowFromPlace(i, place)}
                onRemove={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                canRemove={rows.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={() =>
                setRows((r) => [...r, { type: 'WEBSITE', label: '', url: '', placeId: '' }])
              }
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
            >
              + Add link
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={save.isPending || !ready}
            onClick={() => save.mutate(rows)}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : 'Finish setup'}
          </button>
          <p className="text-xs text-muted-foreground">
            {ready
              ? 'You can edit this anytime later.'
              : mode === 'single'
                ? 'Pick a place to continue.'
                : 'Add at least one destination.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
