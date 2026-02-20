"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilled = searchParams.get("code") || "";

  const [joinCode, setJoinCode] = useState(prefilled);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/workspaces/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          const callback = joinCode.trim()
            ? `/join?code=${encodeURIComponent(joinCode.trim())}`
            : "/join";
          router.push(`/sign-in?callbackUrl=${encodeURIComponent(callback)}`);
          return;
        }
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/${data.workspaceId}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
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
            JOIN A WORKSPACE
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-sm uppercase tracking-widest text-muted mb-2">
              JOIN CODE
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-border bg-panel px-4 py-3 font-mono text-lg tracking-widest text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              placeholder="XXXXXXXX"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}

          <SlantedButton disabled={loading} className="w-full">
            {loading ? "JOINING..." : "JOIN WORKSPACE"}
          </SlantedButton>
        </form>

        <p className="mt-6 text-center font-body text-base text-muted">
          No account?{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
