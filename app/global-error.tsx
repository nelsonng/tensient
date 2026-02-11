"use client";

import { useEffect } from "react";

/**
 * Global error boundary for errors in the root layout.
 * Must include its own <html> and <body> tags since the root layout
 * is not rendered when this boundary catches.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        route: window.location.pathname,
        source: "global-error-boundary",
      }),
    }).catch(() => {
      // Non-critical -- don't cascade
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ backgroundColor: "#0a0a0a", color: "#e5e5e5", fontFamily: "monospace" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2rem" }}>
              A critical error occurred
            </p>
            <button
              onClick={reset}
              style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6ee7b7", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
