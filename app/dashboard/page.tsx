import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { memberships, workspaces } from "@/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

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
        <p className="font-body text-base text-muted">
          You are not a member of any workspace yet.
        </p>
      </div>
    </div>
  );
}
