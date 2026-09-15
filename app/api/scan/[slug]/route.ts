import { resolveForSlug } from '@/domains/scan/server/service';
import { apiRoute } from '@/lib/api';

/**
 * Read-only landing payload. NEVER records a scan — scan recording happens in
 * the /s/[slug] page server component, exactly once per request.
 */
export const GET = apiRoute('GET', '/api/scan/[slug]', async (_req, ctx) => {
  const { slug } = await ctx.params;
  const { payload } = await resolveForSlug(slug);
  return payload;
});
