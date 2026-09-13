'use client';

/**
 * Shared error boundary for route-group layouts. Each group's error.tsx
 * re-exports this so all groups catch errors with one consistent UI.
 */
export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong in this section</h1>
      <p className="mt-2 text-muted-foreground">
        The error is logged with context. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded bg-primary px-4 py-2 text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
