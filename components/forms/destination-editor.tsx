'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLinkIcon, MapPinIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import {
  destinationKeys,
  destinationQueries,
  type SetupAuth,
} from '@/domains/destination/api/mutations';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export type GooglePlaceValue = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string | null;
};

export type ExtraLinkValue = {
  label: string;
  url: string;
};

const field = 'w-full rounded border px-3 py-2 text-sm';

/** Google Maps place page for a given place id — used for the "open externally" affordance. */
export function mapsPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

/**
 * Debounced Google Place lookup. Shows suggestions while typing, and once a
 * place is chosen renders a preview card below the input instead.
 */
export function PlaceSearch({
  value,
  onSelect,
  setupAuth,
}: {
  value: GooglePlaceValue | null;
  onSelect: (place: GooglePlaceValue) => void;
  /** Required on the public accountless setup page, where there is no merchant session. */
  setupAuth?: SetupAuth;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [dismissed, setDismissed] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 350);

  const isStaleQuery = value !== null && query === value.name;
  const { data, isFetching, error } = useQuery({
    queryKey: destinationKeys.places(debouncedQuery),
    queryFn: () => destinationQueries.places(debouncedQuery, setupAuth).queryFn(),
    enabled: debouncedQuery.trim().length > 0 && !isStaleQuery,
    retry: false,
  });

  const wantsSuggestions = query.trim().length > 0 && !isStaleQuery;
  const open = wantsSuggestions && !dismissed && (isFetching || !!error || !!data);

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next) setDismissed(true);
        }}
      >
        <PopoverTrigger render={<div className="relative" />}>
          <input
            id="google-place-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDismissed(false);
            }}
            placeholder="Search a business on Google…"
            aria-label="Search a business on Google"
            className={field}
          />
          {isFetching && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
              …
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="p-1 max-h-40 overflow-y-auto"
          initialFocus={false}
          finalFocus={false}
        >
          {error ? (
            <p className="p-2 text-xs text-destructive">
              {error instanceof Error ? error.message : 'Could not search Google Places'}
            </p>
          ) : isFetching ? (
            <p className="p-2 text-xs text-muted-foreground">Searching…</p>
          ) : data && data.length > 0 ? (
            <ul className="space-y-1">
              {data.map((p) => (
                <li key={p.googlePlaceId}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({
                        googlePlaceId: p.googlePlaceId,
                        name: p.name,
                        formattedAddress: p.formattedAddress,
                      });
                      setQuery(p.name);
                      setDismissed(true);
                    }}
                    className="w-full rounded p-2 text-left text-sm hover:bg-muted cursor-pointer"
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.formattedAddress && (
                      <span className="block text-xs text-muted-foreground">
                        {p.formattedAddress}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-2 text-xs text-muted-foreground">No results found for “{query}”</p>
          )}
        </PopoverContent>
      </Popover>

      {value && (
        <div className="flex items-start gap-2 rounded border p-3">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            {value.formattedAddress && (
              <p className="text-xs text-muted-foreground">{value.formattedAddress}</p>
            )}
          </div>
          <a
            href={mapsPlaceUrl(value.googlePlaceId)}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in Google Maps"
            className="shrink-0 rounded border p-1.5 hover:bg-muted"
          >
            <ExternalLinkIcon className="size-4" />
          </a>
        </div>
      )}
    </div>
  );
}

/** One extra link row: title + URL, removable. */
export function ExtraLinkRow({
  index,
  value,
  onChange,
  onRemove,
}: {
  index: number;
  value: ExtraLinkValue;
  onChange: (patch: Partial<ExtraLinkValue>) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="space-y-2 rounded border p-3">
      <CardHeader className="flex items-center justify-between p-0">
        <CardTitle className="text-sm font-medium">Link {index + 1}</CardTitle>
        <Button
          variant="ghost"
          type="button"
          onClick={onRemove}
          aria-label={`Remove link ${index + 1}`}
        >
          <XIcon className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 p-0">
        <label htmlFor={`link-title-${index}`} className="text-xs text-muted-foreground">
          Title
        </label>
        <input
          id={`link-title-${index}`}
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. WhatsApp"
          className={field}
        />
        <div className="space-y-1">
          <label htmlFor={`link-url-${index}`} className="text-xs text-muted-foreground">
            Link
          </label>
          <input
            id={`link-url-${index}`}
            value={value.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
            type="url"
            className={field}
          />
        </div>
      </CardContent>
    </Card>
  );
}
