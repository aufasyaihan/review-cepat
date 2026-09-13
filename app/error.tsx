'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Server-side error context is logged via instrumentation.ts / route handlers.
  void error;

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        We log every error with context. Please try again.
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
