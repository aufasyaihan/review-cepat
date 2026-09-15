import { SkeletonLoader } from '@/components/common/skeleton-loader';

export default function AdminLoading() {
  return (
    <div className="py-6" role="status">
      <SkeletonLoader>
        <div className="space-y-4">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="rounded-lg border bg-card p-5">
            <div className="h-9 w-full rounded bg-muted" />
            <div className="mt-2 h-9 w-3/4 rounded bg-muted" />
            <div className="mt-2 h-9 w-1/2 rounded bg-muted" />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="h-9 w-full rounded bg-muted" />
            <div className="mt-2 h-9 w-3/4 rounded bg-muted" />
          </div>
        </div>
      </SkeletonLoader>
    </div>
  );
}
