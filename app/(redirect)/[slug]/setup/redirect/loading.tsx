import { SkeletonLoader } from '@/components/common/skeleton-loader';

export default function SetupRedirectLoading() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center gap-6">
      <SkeletonLoader>
        <div className="space-y-5">
          <div className="h-6 w-56 rounded bg-muted" />
          <div className="h-10 w-64 rounded bg-muted" />
          <div className="space-y-3 rounded-lg border bg-card p-5">
            <div className="h-9 w-full rounded bg-muted" />
            <div className="h-9 w-full rounded bg-muted" />
            <div className="h-9 w-full rounded bg-muted" />
          </div>
          <div className="h-10 w-32 rounded bg-primary/40" />
        </div>
      </SkeletonLoader>
    </div>
  );
}
