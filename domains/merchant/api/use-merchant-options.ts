'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { adminMerchantKeys } from '@/domains/merchant/api/queries';
import type { OrganizationWithDevices, Paginated } from '@/domains/merchant/server/service';
import { api } from '@/lib/http';

const PAGE_SIZE = 10;

/**
 * Debounced option source for the "move to merchant"/"owner" comboboxes.
 * Lazily paginated via useInfiniteQuery — never prefetched (FR-056).
 */
export function useMerchantOptions(q: string) {
  const query = useInfiniteQuery({
    queryKey: adminMerchantKeys.options(q),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api
        .get<Paginated<OrganizationWithDevices>>('/api/organizations')
        .setQuery({ q, page: pageParam, limit: PAGE_SIZE })
        .send(),
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });

  const options = (query.data?.pages ?? []).flatMap((page) =>
    page.rows.map((org) => ({ id: org.id, name: org.name })),
  );

  return { ...query, options };
}
