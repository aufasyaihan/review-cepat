import { SkeletonLoader } from '@/components/common/skeleton-loader';

export default function SetupLoading() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center gap-4">
      <SkeletonLoader>
        <div className="space-y-4">
          <div className="h-6 w-56 rounded bg-muted" />
          <div className="h-10 w-64 rounded bg-muted" />
          <div className="rounded-lg border bg-card p-6">
            <div className="h-5 w-32 rounded bg-muted" aria-hidden />
            <p className="mt-2 h-4 w-48 rounded bg-muted" />
            <div className="mt-4 h-9 w-full rounded bg-muted" />
            <div className="mt-3 h-9 w-full rounded bg-primary/40" />
          </div>
        </div>
      </SkeletonLoader>
    </div>
  );
}
