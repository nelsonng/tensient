import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  // Find user's first workspace
  const [membership] = await db
    .select({ workspaceId: memberships.workspaceId })
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (membership) {
    redirect(`/dashboard/${membership.workspaceId}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-4">
          NO WORKSPACE
        </h1>
        <p className="font-body text-base text-muted mb-6">
          You are not a member of any workspace yet.
        </p>
        <Link
          href="/join"
          className="font-mono text-sm uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
        >
          JOIN A WORKSPACE
        </Link>
      </div>
    </div>
  );
}
