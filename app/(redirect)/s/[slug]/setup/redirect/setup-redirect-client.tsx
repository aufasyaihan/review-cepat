'use client';

import { ExternalLinkIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  ExtraLinkRow,
  type ExtraLinkValue,
  type GooglePlaceValue,
  mapsPlaceUrl,
  PlaceSearch,
} from '@/components/forms/destination-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { deriveReviewUrl } from '@/domains/destination';
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
  const [place, setPlace] = useState<GooglePlaceValue | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const [links, setLinks] = useState<ExtraLinkValue[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = useAction(
    () =>
      saveSetupDestinationsAction(deviceId, token, {
        destinations: [
          ...(place
            ? [
                {
                  type: 'GOOGLE_REVIEW' as const,
                  label: place.name,
                  placeId: place.googlePlaceId,
                  position: 0,
                  active: true,
                },
              ]
            : []),
          ...links.map((link, i) => ({
            type: 'CUSTOM_URL' as const,
            label: link.label || undefined,
            url: link.url,
            position: (place ? 1 : 0) + i,
            active: true,
          })),
        ],
      }),
    {
      successMsg: 'Device set up',
      onSuccess: (data) => router.replace(`/s/${data.slug}`),
    },
  );

  const updateLink = (i: number, patch: Partial<ExtraLinkValue>) =>
    setLinks((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const validLinks = links.filter((l) => l.url.trim().length > 0);
  const canSubmit = !!place || validLinks.length > 0;

  return (
    <>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            Configure {deviceName}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground text-center">
            Choose what customers reach when they scan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium" htmlFor="google-place-search">
              Google Place
            </Label>
            <PlaceSearch value={place} onSelect={setPlace} setupAuth={{ deviceId, token }} />
          </div>

          <div className="flex items-center gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowLinks(true);
                setLinks((rows) => [...rows, { label: '', url: '' }]);
              }}
            >
              + Add More Links
            </Button>
          </div>

          <div className="max-h-[calc(100dvh-40rem)] overflow-y-auto pr-2">
            {showLinks && (
              <div className="space-y-3">
                {links.map((link, i) => (
                  <ExtraLinkRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: editable unsaved rows, index is position identity until saved
                    key={i}
                    index={i}
                    value={link}
                    onChange={(patch) => updateLink(i, patch)}
                    onRemove={() => setLinks((rows) => rows.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            className="w-full"
          >
            Finish
          </Button>
          {!canSubmit && (
            <p className="text-center text-xs text-muted-foreground">
              Pick a Google place or add at least one link to continue.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm setup</DialogTitle>
            <DialogDescription>
              Review what customers will be sent to before finishing setup.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {place && (
              <div className="space-y-1 rounded border p-3 text-sm">
                <p className="font-medium">{place.name}</p>
                {place.formattedAddress && (
                  <p className="text-xs text-muted-foreground">{place.formattedAddress}</p>
                )}
                <div className="flex flex-wrap gap-3 pt-1 text-xs">
                  <a
                    href={deriveReviewUrl(place.googlePlaceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    Review link <ExternalLinkIcon className="size-3" />
                  </a>
                  <a
                    href={mapsPlaceUrl(place.googlePlaceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    Google Maps place <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
              </div>
            )}

            {validLinks.map((link) => (
              <div key={link.url} className="space-y-1 rounded border p-3 text-sm">
                <p className="font-medium">{link.label || 'Untitled link'}</p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                >
                  {link.url} <ExternalLinkIcon className="size-3" />
                </a>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Back
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Confirm & Finish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
