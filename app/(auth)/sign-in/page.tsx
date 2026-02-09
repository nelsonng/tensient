"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
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
            AMBIENT ENTERPRISE TENSION
          </p>
          <p className="font-mono text-sm uppercase tracking-widest text-muted/60">
            SIGN IN
          </p>
        </div>

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-mono text-sm uppercase tracking-widest text-muted">
                PASSWORD
              </label>
              <Link
                href="/forgot-password"
                className="font-mono text-xs text-muted hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-panel px-4 py-3 font-body text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}

          <SlantedButton
            disabled={loading}
            className="w-full"
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
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
