import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.error("BLOB_READ_WRITE_TOKEN is not configured -- audio upload will fail");
    return NextResponse.json(
      { error: "Voice recording is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "audio/webm",
          "audio/webm;codecs=opus",
          "audio/mp4",
          "audio/mpeg",
          "audio/ogg",
        ],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB (~1.7 hours at 128kbps)
      }),
      onUploadCompleted: async ({ blob }) => {
        logger.info("Audio upload completed", {
          url: blob.url,
          size: blob.size,
          userId: session.user?.id,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    logger.error("Audio upload token handler failed", { error: String(error) });
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
