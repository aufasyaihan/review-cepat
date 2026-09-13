import { QueryClient } from '@tanstack/react-query';

let browserQueryClient: QueryClient | undefined;

/**
 * One query client per server render, one shared client in the browser
 * (Next.js 16 + TanStack Query SSR pattern).
 */
export function getQueryClient() {
  if (typeof window === 'undefined') {
    return new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000, retry: 1 },
      },
    });
  }
  browserQueryClient ??= new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 1 },
    },
  });
  return browserQueryClient;
}
