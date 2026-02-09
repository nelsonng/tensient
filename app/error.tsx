"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-2">
          Something went wrong
        </h1>
        <p className="font-mono text-sm text-muted uppercase tracking-widest mb-8">
          An unexpected error occurred
        </p>
        <button
          onClick={reset}
          className="font-mono text-xs uppercase tracking-widest text-primary hover:underline cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
