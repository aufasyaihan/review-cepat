import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { scanKeys } from '@/domains/scan/api/queries';
import { recordScan, resolveForSlug } from '@/domains/scan/server/service';
import { hashIp } from '@/lib/codes';
import { getQueryClient } from '@/lib/query-client';
import { parseUserAgent } from '@/lib/ua';
import { LandingClient } from './landing-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { device } = await resolveForSlug(slug);
  if (!device) return { title: 'Not found' };
  return {
    title: device.name,
    description: `${device.name} — tap or scan to open the links.`,
  };
}

export default async function ScanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = await resolveForSlug(slug);
  const { outcome } = resolved;
  const device = resolved.device;
  if (!device) {
    notFound();
  }

  if (device.status === 'UNCLAIMED') {
    redirect(`/s/${slug}/setup`);
  }

  const h = await headers();
  const ua = h.get('user-agent');
  const ip = h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? null;
  const parsed = parseUserAgent(ua);
  const referrer = h.get('referer');
  const common = {
    browser: parsed.browser,
    deviceType: parsed.deviceType,
    country: null,
    city: null,
    referrer,
    source: 'link' as const,
    userAgent: ua,
    ipHash: ip ? hashIp(ip) : null,
  };

  if (outcome === 'REDIRECTED') {
    const dest = device.destinations.find((d) => d.active && d.url);
    // Record exactly once, server-side, before the redirect (spec FR-012, contract).
    await recordScan({
      deviceId: device.id,
      destinationId: dest?.id ?? null,
      outcome,
      ...common,
    });
    redirect(dest?.url ?? '/');
  }

  // LANDING_SHOWN | INACTIVE
  await recordScan({
    deviceId: device.id,
    destinationId: null,
    outcome,
    ...common,
  });

  const queryClient = getQueryClient();
  const payload = {
    slug: device.slug,
    name: device.name,
    outcome,
    links: device.destinations
      .filter((d) => d.active && d.url)
      .map((d) => ({ id: d.id, type: d.type, label: d.label, url: d.url as string })),
  };
  queryClient.setQueryData(scanKeys.landing(slug), payload);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LandingClient slug={slug} />
    </HydrationBoundary>
  );
}
