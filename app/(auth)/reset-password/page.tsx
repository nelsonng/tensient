"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/">
            <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
          </Link>
          <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
            INVALID LINK
          </p>
        </div>

        <p className="font-body text-base text-muted mb-6">
          This reset link is invalid or has expired.
        </p>

        <p className="text-center font-body text-base text-muted">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/">
            <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
          </Link>
          <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
            PASSWORD RESET
          </p>
        </div>

        <p className="font-body text-base text-muted mb-6">
          Your password has been reset successfully.
        </p>

        <Link href="/sign-in">
          <SlantedButton className="w-full">SIGN IN</SlantedButton>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <Link href="/">
          <GlitchText text="TENSIENT" as="h1" className="text-3xl mb-2" />
        </Link>
        <p className="font-mono text-sm uppercase tracking-widest text-muted mb-1">
          AMBIENT ENTERPRISE TENSION
        </p>
        <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
          RESET PASSWORD
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-sm uppercase tracking-widest text-muted mb-2">
            NEW PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-border bg-panel px-4 py-3 font-body text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-sm uppercase tracking-widest text-muted mb-2">
            CONFIRM PASSWORD
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-border bg-panel px-4 py-3 font-body text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {error && (
          <p className="font-mono text-xs text-destructive">{error}</p>
        )}

        <SlantedButton disabled={loading} className="w-full">
          {loading ? "RESETTING..." : "RESET PASSWORD"}
        </SlantedButton>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
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
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
