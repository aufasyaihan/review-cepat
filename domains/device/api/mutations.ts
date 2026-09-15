import type { SetDestinationsInput } from '@/domains/destination/schemas';
import type { DestinationDto, DeviceSummary } from '@/domains/device/types';
import { api } from '@/lib/http';

export const deviceMutations = {
  claim: () => ({
    mutationFn: (claimCode: string) =>
      api.post<DeviceSummary>('/api/device/claim').setBody({ claimCode }).send(),
  }),
  publish: (id: string) => ({
    mutationFn: () => api.post<DeviceSummary>(`/api/device/${id}/publish`).send(),
  }),
  unpublish: (id: string) => ({
    mutationFn: () => api.post<DeviceSummary>(`/api/device/${id}/unpublish`).send(),
  }),
  setDestinations: (id: string) => ({
    mutationFn: (input: SetDestinationsInput) =>
      api.post<DestinationDto[]>(`/api/device/${id}/destinations`).setBody(input).send(),
  }),
  transfer: (id: string) => ({
    mutationFn: (toMerchantId: number) =>
      api.post<DeviceSummary>(`/api/device/${id}/transfer`).setBody({ toMerchantId }).send(),
  }),
};
