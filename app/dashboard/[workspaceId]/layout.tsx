import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, workspaces } from "@/lib/db/schema";
import { DashboardNav } from "./dashboard-nav";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const userWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, session.user.id));

  return (
    <div className="min-h-screen">
      {!session.user.emailVerified && <EmailVerificationBanner />}
      <DashboardNav
        workspaceId={workspaceId}
        isSuperAdmin={!!session.user.isSuperAdmin}
        workspaces={userWorkspaces}
      />
      {children}
    </div>
  );
}
