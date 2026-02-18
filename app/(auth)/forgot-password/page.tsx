"use client";

import { useState } from "react";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/">
              <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
            </Link>
            <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
              CHECK YOUR EMAIL
            </p>
          </div>

          <p className="font-body text-base text-muted mb-6">
            If an account exists for <span className="text-foreground">{email}</span>,
            we sent a password reset link. Check your inbox and spam folder.
          </p>

          <p className="text-center font-body text-base text-muted">
            <Link href="/sign-in" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/">
            <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
          </Link>
          <p className="font-mono text-sm uppercase tracking-widest text-muted mb-1">
            FOR PEOPLE WHO THINK FOR A LIVING
          </p>
          <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
            FORGOT PASSWORD
          </p>
        </div>

        <p className="font-body text-base text-muted mb-6">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-sm uppercase tracking-widest text-muted mb-2">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-panel px-4 py-3 font-body text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              placeholder="you@company.com"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}

          <SlantedButton disabled={loading} className="w-full">
            {loading ? "SENDING..." : "SEND RESET LINK"}
          </SlantedButton>
        </form>

        <p className="mt-6 text-center font-body text-base text-muted">
          Remember your password?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
