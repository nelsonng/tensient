import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold uppercase tracking-tight mb-2">
          404
        </h1>
        <p className="font-mono text-sm text-muted uppercase tracking-widest mb-8">
          Page not found
        </p>
        <Link
          href="/dashboard"
          className="font-mono text-xs uppercase tracking-widest text-primary hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
