import type { ProfileOutput } from '@/domains/merchant/schemas/profile';
import type { MemberWithUser } from '@/domains/merchant/server/service';
import { api } from '@/lib/http';

export const merchantKeys = {
  all: ['merchant'] as const,
  profile: () => [...merchantKeys.all, 'profile'] as const,
};

export const memberKeys = {
  list: () => [...merchantKeys.all, 'members'] as const,
};

export const merchantQueries = {
  profile: () => ({
    queryKey: merchantKeys.profile(),
    queryFn: () => api.get<ProfileOutput | null>('/api/merchant/profile').send(),
  }),
};

export const memberQueries = {
  list: () => ({
    queryKey: memberKeys.list(),
    queryFn: () => api.get<MemberWithUser[]>('/api/merchant/members').send(),
  }),
};
