'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { destinationKeys, destinationQueries } from '@/domains/destination/api/mutations';
import { saveSetupDestinationsAction } from '@/domains/destination/server/setup-actions';
import { useAction } from '@/hooks/use-action';

type RowType =
  | 'GOOGLE_REVIEW'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'TIKTOK'
  | 'WHATSAPP'
  | 'WEBSITE'
  | 'CUSTOM_URL';

const TYPE_OPTIONS: RowType[] = [
  'GOOGLE_REVIEW',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'WHATSAPP',
  'WEBSITE',
  'CUSTOM_URL',
];

type Row = { type: RowType; label: string; url: string; placeId: string };

const field = 'w-full rounded border px-3 py-2 text-sm';

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
  const [rows, setRows] = useState<Row[]>([
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

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const setRowFromPlace = (i: number, place: { googlePlaceId: string; name: string }) =>
    update(i, { type: 'GOOGLE_REVIEW', placeId: place.googlePlaceId, label: place.name });

  const canSave = rows.some((r) => r.placeId || r.url);
  const ready = mode === 'single' ? rows.length === 1 && !!rows[0].placeId : canSave;

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center gap-6">
      <header>
        <h1 className="text-xl font-semibold">Configure {deviceName}</h1>
        <p className="text-sm text-muted-foreground">Choose what customers reach when they scan.</p>
      </header>

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
            Single link: pick a business on Google — customers are redirected straight to its review
            page.
          </p>
          <PlaceSearch
            value={rows[0]?.label ?? ''}
            onSelect={(place) => setRowFromPlace(0, place)}
          />
        </div>
      ) : (
        <div className="space-y-3 rounded border p-5">
          {rows.map((row, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: editable unsaved rows, index is position identity until saved
              key={i}
              className="space-y-2 rounded border p-3"
            >
              <div className="flex items-center gap-2">
                <select
                  value={row.type}
                  onChange={(e) => update(i, { type: e.target.value as RowType })}
                  className={field}
                  aria-label={`Destination type ${i + 1}`}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                  className="ml-auto rounded border px-2 text-sm hover:bg-muted"
                  aria-label="Remove destination"
                  disabled={rows.length <= 1}
                >
                  ✕
                </button>
              </div>

              <input
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder={row.type === 'GOOGLE_REVIEW' ? 'Business name' : 'Label (optional)'}
                aria-label={`Label ${i + 1}`}
                className={field}
              />

              {row.type === 'GOOGLE_REVIEW' ? (
                <PlaceSearch value={row.label} onSelect={(place) => setRowFromPlace(i, place)} />
              ) : (
                <input
                  value={row.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="https://…"
                  type="url"
                  aria-label="Destination URL"
                  className={field}
                />
              )}
            </div>
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
    </div>
  );
}

function PlaceSearch({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (p: { googlePlaceId: string; name: string }) => void;
}) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: destinationKeys.places(submitted),
    queryFn: () => destinationQueries.places(submitted).queryFn(),
    enabled: submitted.length > 0,
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a business on Google…"
          aria-label="Search a business on Google"
          className={field}
        />
        <button
          type="button"
          disabled={isFetching || query.trim().length === 0}
          onClick={() => setSubmitted(query)}
          className="rounded border px-3 text-sm hover:bg-muted disabled:opacity-60"
        >
          {isFetching ? '…' : 'Search'}
        </button>
      </div>
      {submitted && data && data.length > 0 && (
        <ul className="space-y-1">
          {data.map((p) => (
            <li key={p.googlePlaceId}>
              <button
                type="button"
                onClick={() => {
                  onSelect({ googlePlaceId: p.googlePlaceId, name: p.name });
                  setQuery(p.name);
                }}
                className="w-full rounded border p-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{p.name}</span>
                {p.formattedAddress && (
                  <span className="block text-xs text-muted-foreground">{p.formattedAddress}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium">{value}</span>
        </p>
      )}
    </div>
  );
}
