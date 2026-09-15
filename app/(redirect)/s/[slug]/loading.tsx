import { SkeletonLoader } from '@/components/common/skeleton-loader';

export default function ScanLoading() {
  return (
    <div className="py-8" role="status">
      <SkeletonLoader>
        <div className="space-y-3">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-12 w-full rounded bg-muted" />
          <div className="h-12 w-full rounded bg-muted" />
          <div className="h-12 w-2/3 rounded bg-muted" />
        </div>
      </SkeletonLoader>
    </div>
  );
}
