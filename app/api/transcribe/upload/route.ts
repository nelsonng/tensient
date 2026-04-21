import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";
import { handleClientUpload, isStorageConfigured } from "@/lib/storage/server";

const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "video/webm",
  "video/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
];

const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB (~1.7 hours at 128kbps)

async function postHandler(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    logger.error("Storage provider is not configured -- audio upload will fail");
    return NextResponse.json(
      { error: "Voice recording is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    return await handleClientUpload({
      request,
      getConstraints: () => ({
        allowedContentTypes: ALLOWED_AUDIO_CONTENT_TYPES,
        maxSizeBytes: MAX_AUDIO_SIZE,
      }),
      onUploadCompleted: async ({ url }) => {
        logger.info("Audio upload completed", {
          url,
          userId: session.user?.id,
        });
      },
    });
  } catch (error) {
    logger.error("Audio upload token handler failed", { error: String(error) });
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withErrorTracking("Upload recording", postHandler);
