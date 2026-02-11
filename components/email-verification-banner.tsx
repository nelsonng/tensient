"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

type BannerState = "idle" | "sending" | "sent" | "error";

export function EmailVerificationBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<BannerState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // Hide during onboarding
  if (pathname.includes("/welcome")) return null;

  async function handleResend() {
    setState("sending");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to send");
        setState("error");
        return;
      }

      setState("sent");
    } catch {
      setErrorMessage("Network error");
      setState("error");
    }
  }

  return (
    <div className="border-b border-warning/30 bg-warning/5 px-6 py-3">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-widest text-warning">
          {state === "sent"
            ? "VERIFICATION EMAIL SENT -- CHECK YOUR INBOX"
            : "PLEASE VERIFY YOUR EMAIL ADDRESS"}
        </p>

        <div className="flex items-center gap-3">
          {state === "error" && (
            <span className="font-mono text-xs text-destructive">
              {errorMessage}
            </span>
          )}

          {state !== "sent" && (
            <button
              onClick={handleResend}
              disabled={state === "sending"}
              className="font-mono text-xs uppercase tracking-widest text-primary hover:text-primary/80 underline underline-offset-2 disabled:opacity-50 disabled:no-underline transition-colors"
            >
              {state === "sending" ? "SENDING..." : "RESEND EMAIL"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
