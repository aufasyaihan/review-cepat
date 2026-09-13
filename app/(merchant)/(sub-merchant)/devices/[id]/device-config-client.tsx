'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { destinationKeys, destinationQueries } from '@/domains/destination/api/mutations';
import type { DESTINATION_TYPES } from '@/domains/destination/constants';
import { setDestinationsAction } from '@/domains/destination/server/actions';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';
import { publishDeviceAction, unpublishDeviceAction } from '@/domains/device/server/actions';
import { useAction } from '@/hooks/use-action';

type RowType = (typeof DESTINATION_TYPES)[number];

type Row = {
  type: RowType;
  label: string;
  url: string;
  placeId: string;
};

const TYPE_OPTIONS: RowType[] = [
  'GOOGLE_REVIEW',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'WHATSAPP',
  'WEBSITE',
  'CUSTOM_URL',
];

const field = 'w-full rounded border px-3 py-2 text-sm';

export function DeviceConfigClient({ deviceId }: { deviceId: string }) {
  const { data: device } = useSuspenseQuery(deviceQueries.detail(deviceId));
  const [rows, setRows] = useState<Row[]>([]);

  const save = useAction(
    (input: { destinations: Row[] }) =>
      setDestinationsAction(deviceId, {
        destinations: input.destinations.map((r, position) => ({
          type: r.type,
          label: r.label || undefined,
          url: r.url || undefined,
          placeId: r.placeId || undefined,
          position,
          active: true,
        })),
      }),
    {
      successMsg: 'Destinations saved',
      keys: [deviceKeys.detail(deviceId)],
    },
  );

  const publish = useAction(publishDeviceAction, {
    successMsg: 'Device published.',
    keys: [deviceKeys.detail(deviceId), deviceKeys.lists()],
  });

  const unpublish = useAction(unpublishDeviceAction, {
    successMsg: 'Device unpublished',
    keys: [deviceKeys.detail(deviceId), deviceKeys.lists()],
  });

  useEffect(() => {
    setRows(
      device.destinations.map((d) => ({
        type: d.type as RowType,
        label: d.label ?? '',
        url: d.url ?? '',
        placeId: d.placeId ?? '',
      })),
    );
  }, [device.destinations]);

  const update = useCallback((i: number, patch: Partial<Row>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }, []);

  const setRowFromPlace = useCallback(
    (i: number, place: { googlePlaceId: string; name: string }) => {
      update(i, { type: 'GOOGLE_REVIEW', placeId: place.googlePlaceId, label: place.name });
    },
    [update],
  );

  const canPublish = useMemo(() => rows.some((r) => r.placeId || r.url), [rows]);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3">
          <Link href="/devices" className="text-sm text-muted-foreground hover:underline">
            ← Devices
          </Link>
          <h1 className="text-2xl font-semibold">{device.name}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{device.status}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Public URL:{' '}
          <a className="underline" href={`/s/${device.slug}`}>
            /s/{device.slug}
          </a>
        </p>
      </header>

      <section className="space-y-3 rounded border p-5">
        <h2 className="text-lg font-semibold">Destinations</h2>
        <p className="text-sm text-muted-foreground">
          One destination = instant redirect. Multiple destinations = a landing page.
        </p>

        {rows.map((row, i) => (
          <DestinationRow
            // biome-ignore lint/suspicious/noArrayIndexKey: editable unsaved rows, index is position identity until saved
            key={i}
            index={i}
            row={row}
            onUpdate={(patch) => update(i, patch)}
            onPlace={(place) => setRowFromPlace(i, place)}
            onRemove={() => setRows((r) => r.filter((_, idx) => idx !== i))}
          />
        ))}

        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          onClick={() =>
            setRows((r) => [...r, { type: 'WEBSITE', label: '', url: '', placeId: '' }])
          }
        >
          + Add destination
        </button>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({ destinations: rows })}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            Save destinations
          </button>
          {device.status === 'PUBLISHED' ? (
            <button
              type="button"
              disabled={unpublish.isPending}
              onClick={() => unpublish.mutate(deviceId)}
              className="rounded border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : (
            device.status !== 'DISABLED' && (
              <button
                type="button"
                disabled={publish.isPending || !canPublish}
                onClick={() => publish.mutate(deviceId)}
                className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                title={canPublish ? undefined : 'Add at least one destination to publish'}
              >
                Publish
              </button>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function DestinationRow({
  row,
  index,
  onUpdate,
  onPlace,
  onRemove,
}: {
  row: Row;
  index: number;
  onUpdate: (patch: Partial<Row>) => void;
  onPlace: (place: { googlePlaceId: string; name: string }) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-2">
        <select
          value={row.type}
          onChange={(e) => onUpdate({ type: e.target.value as RowType })}
          className={field}
          aria-label={`Destination type ${index + 1}`}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded border px-2 text-sm hover:bg-muted"
          aria-label="Remove destination"
        >
          ✕
        </button>
      </div>

      <input
        value={row.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        aria-label={
          row.type === 'GOOGLE_REVIEW'
            ? `Business name ${index + 1}`
            : `Label ${index + 1} (optional)`
        }
        placeholder={
          row.type === 'GOOGLE_REVIEW' ? 'Business name (filled from Google)' : 'Label (optional)'
        }
        className={field}
      />

      {row.type === 'GOOGLE_REVIEW' ? (
        <PlaceSearch onSelect={onPlace} />
      ) : (
        <input
          value={row.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://…"
          type="url"
          aria-label="Destination URL"
          className={field}
        />
      )}
    </div>
  );
}

function PlaceSearch({
  onSelect,
}: {
  onSelect: (p: { googlePlaceId: string; name: string }) => void;
}) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: destinationKeys.places(submitted),
    queryFn: () => destinationQueries.places(submitted).queryFn(),
    enabled: submitted.length > 0,
  });

  useEffect(() => {
    if (data && data.length > 0) {
      const first = data[0];
      onSelect({ googlePlaceId: first.googlePlaceId, name: first.name });
    }
  }, [data, onSelect]);

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
                onClick={() => onSelect({ googlePlaceId: p.googlePlaceId, name: p.name })}
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
    </div>
  );
}
