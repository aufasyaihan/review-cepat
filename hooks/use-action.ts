'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { ActionResult } from '@/lib/action-result';

type QueryKey = readonly unknown[];

/**
 * Runs a Server Action through TanStack Query, then:
 * - toasts success (or the action's error)
 * - invalidates the provided TanStack Query keys (cache revalidation)
 * - calls onSuccess with the returned data for navigation, etc.
 */
export function useAction<TArgs, TData>(
  action: (args: TArgs) => Promise<ActionResult<TData>>,
  options: {
    successMsg: string;
    keys?: QueryKey[];
    onSuccess?: (data: TData) => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(options.successMsg);
      for (const key of options.keys ?? []) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      options.onSuccess?.(result.data);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Something went wrong'),
  });
}
