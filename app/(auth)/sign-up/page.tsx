"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Auto sign in after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but sign in failed. Try signing in.");
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Network error");
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
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            CREATE ACCOUNT
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs uppercase tracking-widest text-muted mb-2">
                FIRST NAME
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-md border border-border bg-panel px-4 py-3 font-body text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-widest text-muted mb-2">
                LAST NAME
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-md border border-border bg-panel px-4 py-3 font-body text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs uppercase tracking-widest text-muted mb-2">
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
            <label className="block font-mono text-xs uppercase tracking-widest text-muted mb-2">
              PASSWORD
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

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}

          <SlantedButton
            disabled={loading}
            className="w-full"
          >
            {loading ? "CREATING..." : "CREATE ACCOUNT"}
          </SlantedButton>
        </form>

        <p className="mt-6 text-center font-body text-sm text-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
