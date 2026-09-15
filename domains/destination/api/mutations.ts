import type { DestinationInput, SetDestinationsInput } from '@/domains/destination/schemas';
import type { PlaceSearchResult } from '@/domains/destination/server/service';
import { api } from '@/lib/http';

export type { DestinationInput, SetDestinationsInput };

export const destinationKeys = {
  places: (query: string) => ['destination', 'places', query] as const,
};

export const destinationQueries = {
  places: (query: string) => ({
    queryKey: destinationKeys.places(query),
    queryFn: () =>
      api.get<PlaceSearchResult[]>('/api/destination/places').setQuery({ query }).send(),
  }),
};

export const destinationMutations = {
  setForDevice: (deviceId: string) => ({
    mutationFn: (input: SetDestinationsInput) =>
      api.post(`/api/device/${deviceId}/destinations`).setBody(input).send(),
  }),
};
