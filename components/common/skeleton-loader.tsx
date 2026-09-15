'use client';

import { type ReactNode, useEffect } from 'react';

/**
 * phantom-ui structure-aware skeleton (FR-033). Registers the Web Component
 * client-side (SSR-safe per phantom-ui docs) and toggles `loading` on the
 * real template so shimmer blocks mirror the actual layout.
 */
export function SkeletonLoader({
  loading = true,
  count,
  countGap,
  children,
}: {
  loading?: boolean;
  count?: number;
  countGap?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    // Safe to import multiple times (guarded define()); dynamic import keeps SSR clean.
    void import('@aejkatappaja/phantom-ui');
  }, []);

  return (
    <phantom-ui loading={loading || undefined} count={count} count-gap={countGap}>
      {children}
    </phantom-ui>
  );
}
