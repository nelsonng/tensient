import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runGenesis } from "@/lib/services/genesis-setup";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const { rawInput } = await request.json();

  if (!rawInput || rawInput.trim().length < 10) {
    return NextResponse.json(
      { error: "Strategy input must be at least 10 characters" },
      { status: 400 }
    );
  }

  try {
    const result = await runGenesis(workspaceId, rawInput);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Genesis failed";
    console.error("Genesis error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
