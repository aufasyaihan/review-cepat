export type Paginated<T> = { rows: T[]; total: number; page: number; limit: number };

export function pageParams(page?: number, limit?: number): { page: number; limit: number } {
  return {
    page: Math.max(1, Math.floor(page ?? 1)),
    limit: Math.min(100, Math.max(1, Math.floor(limit ?? 10))),
  };
}
