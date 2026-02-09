import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processCapture } from "@/lib/services/process-capture";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const { content } = await request.json();

  if (!content || content.trim().length < 5) {
    return NextResponse.json(
      { error: "Capture content must be at least 5 characters" },
      { status: 400 }
    );
  }

  try {
    const result = await processCapture(
      session.user.id,
      workspaceId,
      content
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Capture processing failed";
    console.error("Capture error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
