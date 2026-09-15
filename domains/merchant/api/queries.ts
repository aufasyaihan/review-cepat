import type { ProfileOutput } from '@/domains/merchant/schemas/profile';
import { api } from '@/lib/http';

export const merchantKeys = {
  all: ['merchant'] as const,
  profile: () => [...merchantKeys.all, 'profile'] as const,
};

export const merchantQueries = {
  profile: () => ({
    queryKey: merchantKeys.profile(),
    queryFn: () => api.get<ProfileOutput | null>('/api/merchant/profile').send(),
  }),
};
