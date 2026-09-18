'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { destinationKeys, destinationQueries } from '@/domains/destination/api/mutations';
import type { DESTINATION_TYPES } from '@/domains/destination/constants';

export type RowType = (typeof DESTINATION_TYPES)[number];

export type DestinationRowValue = {
  type: RowType;
  label: string;
  url: string;
  placeId: string;
};

export type PlaceSelection = { googlePlaceId: string; name: string };

const field = 'w-full rounded border px-3 py-2 text-sm';

export const TYPE_OPTIONS: RowType[] = [
  'GOOGLE_REVIEW',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'WHATSAPP',
  'WEBSITE',
  'CUSTOM_URL',
];

/** One editable destination row: type, label, and either Google place search or URL. */
export function DestinationRow({
  row,
  index,
  onUpdate,
  onPlace,
  onRemove,
  canRemove,
}: {
  row: DestinationRowValue;
  index: number;
  onUpdate: (patch: Partial<DestinationRowValue>) => void;
  onPlace: (place: PlaceSelection) => void;
  onRemove: () => void;
  canRemove?: boolean;
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
          disabled={canRemove === false}
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
          placeholder={row.type === 'WHATSAPP' ? 'https://wa.me/6281234567890' : 'https://…'}
          type="url"
          aria-label="Destination URL"
          className={field}
        />
      )}
    </div>
  );
}

/** Google Places search box; renders suggestions and reports selections via onSelect. */
export function PlaceSearch({
  onSelect,
  value,
}: {
  onSelect: (p: PlaceSelection) => void;
  value?: string;
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
