import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardNav } from "./dashboard-nav";

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

  return (
    <div className="min-h-screen">
      <DashboardNav workspaceId={workspaceId} />
      {children}
    </div>
  );
}
