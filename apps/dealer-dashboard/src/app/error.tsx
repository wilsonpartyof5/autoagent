'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2>Something went wrong.</h2>
      <p className="text-sm text-muted-foreground">{error.digest ?? error.message}</p>
      <button onClick={reset} className="underline">
        Try again
      </button>
    </div>
  );
}
