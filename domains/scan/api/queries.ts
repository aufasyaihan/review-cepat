import { api } from '@/lib/http';

export type ScanLandingJson = {
  slug: string;
  name: string;
  outcome: 'REDIRECTED' | 'LANDING_SHOWN' | 'INACTIVE' | 'NOT_FOUND';
  links: Array<{ id: string; type: string; label: string | null; url: string }>;
};

export const scanKeys = {
  landing: (slug: string) => ['scan', 'landing', slug] as const,
};

/**
 * Query factory for the public landing page. The server component prefetches
 * the payload (see app/s/[slug]/page.tsx); this queryFn is a client-side
 * fallback that hits the read-only scan route (never records a scan).
 */
export const scanQueries = {
  landing: (slug: string) => ({
    queryKey: scanKeys.landing(slug),
    queryFn: () => api.get<ScanLandingJson>(`/api/scan/${slug}`).send(),
  }),
};
