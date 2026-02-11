"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to platform_events via the client-error API
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        route: window.location.pathname,
        source: "error-boundary",
      }),
    }).catch(() => {
      // Non-critical -- don't cascade
    });
  }, [error]);

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
