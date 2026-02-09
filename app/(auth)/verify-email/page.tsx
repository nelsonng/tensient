"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "Invalid verification link."
  );

  const verify = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Verification failed");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMessage("Network error");
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    verify();
  }, [verify]);

  if (status === "loading") {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/">
            <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
          </Link>
          <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
            VERIFYING EMAIL
          </p>
        </div>
        <p className="font-body text-base text-muted">
          Verifying your email address...
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/">
            <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
          </Link>
          <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
            EMAIL VERIFIED
          </p>
        </div>

        <p className="font-body text-base text-muted mb-6">
          Your email has been verified. You&apos;re all set.
        </p>

        <Link href="/dashboard">
          <SlantedButton className="w-full">GO TO DASHBOARD</SlantedButton>
        </Link>
      </div>
    );
  }

  // Error state
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <Link href="/">
          <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
        </Link>
        <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
          VERIFICATION FAILED
        </p>
      </div>

      <p className="font-body text-base text-muted mb-6">{errorMessage}</p>

      <p className="text-center font-body text-base text-muted">
        <Link href="/sign-in" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense
        fallback={
          <div className="w-full max-w-sm">
            <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
            <p className="font-mono text-sm text-muted">Loading...</p>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
