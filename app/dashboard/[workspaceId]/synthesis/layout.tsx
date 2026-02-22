import { type ReactNode } from "react";
import { SynthesisSubnav } from "./synthesis-subnav";

export default async function SynthesisLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <div className="space-y-4">
      <SynthesisSubnav workspaceId={workspaceId} />
      {children}
    </div>
  );
}
