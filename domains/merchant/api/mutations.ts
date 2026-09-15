import type { ProfileInput, ProfileOutput } from '@/domains/merchant/schemas/profile';
import { api } from '@/lib/http';

export const merchantMutations = {
  profile: () => ({
    mutationFn: (input: ProfileInput) =>
      api.post<ProfileOutput>('/api/merchant/profile').setBody(input).send(),
  }),
};
