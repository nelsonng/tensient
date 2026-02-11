"use client";

import { useEffect } from "react";

/**
 * Belt-and-suspenders client error listener.
 * Catches errors that escape React error boundaries:
 * - window.onerror (uncaught exceptions)
 * - unhandledrejection (unhandled promise rejections)
 *
 * Deduplicates reports within a 2-second window to avoid flooding.
 */
export function GlobalErrorListener() {
  useEffect(() => {
    const recentReports = new Set<string>();

    function reportError(payload: {
      message: string;
      stack?: string;
      source: string;
    }) {
      // Deduplicate by message within a short window
      const key = payload.message;
      if (recentReports.has(key)) return;
      recentReports.add(key);
      setTimeout(() => recentReports.delete(key), 2000);

      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          route: window.location.pathname,
        }),
      }).catch(() => {
        // Non-critical
      });
    }

    function handleError(event: ErrorEvent) {
      reportError({
        message: event.message || "Uncaught error",
        stack: event.error?.stack,
        source: "window-onerror",
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportError({
        message:
          reason instanceof Error
            ? reason.message
            : String(reason || "Unhandled promise rejection"),
        stack: reason instanceof Error ? reason.stack : undefined,
        source: "unhandled-rejection",
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
