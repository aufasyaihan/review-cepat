import { z } from 'zod';

/**
 * Parses `from`/`to` date-range query params (date or ISO string). Rejects
 * malformed dates, `from` > `to`, and open-ended ranges (constitution VII).
 * Throws a ZodError with a clear message so the apiRoute wrapper 400s.
 */
export function parseDateRangeQuery(url: string): { from: Date; to: Date } {
  const params = new URL(url).searchParams;
  const rawFrom = params.get('from');
  const rawTo = params.get('to');

  if (!rawFrom || !rawTo) {
    throw new z.ZodError([
      { code: 'custom', message: 'Both `from` and `to` query parameters are required', path: [] },
    ]);
  }

  const from = new Date(rawFrom);
  const to = new Date(rawTo);
  for (const [label, parsed] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (Number.isNaN(parsed.getTime())) {
      throw new z.ZodError([
        { code: 'custom', message: `Invalid date for \`${label}\``, path: [label] },
      ]);
    }
  }

  if (from.getTime() > to.getTime()) {
    throw new z.ZodError([
      { code: 'custom', message: '`from` must be on or before `to`', path: ['from'] },
    ]);
  }

  return { from, to };
}
