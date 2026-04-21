import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";
import { handleClientUpload, isStorageConfigured } from "@/lib/storage/server";

const ALLOWED_CONTENT_TYPES = [
  // Documents
  "application/pdf",
  "text/plain",
  "text/markdown",
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // Audio (keep supporting voice uploads through the generic handler too)
  "audio/webm",
  "audio/webm;codecs=opus",
  "video/webm",
  "video/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB for documents/images
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB for audio

async function postHandler(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    logger.error("Storage provider is not configured");
    return NextResponse.json(
      { error: "File upload is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    return await handleClientUpload({
      request,
      getConstraints: (pathname) => {
        const isAudio = pathname.startsWith("audio/");
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maxSizeBytes: isAudio ? MAX_AUDIO_SIZE : MAX_FILE_SIZE,
        };
      },
      onUploadCompleted: async ({ url, pathname }) => {
        logger.info("File upload completed", {
          url,
          pathname,
          userId: session.user?.id,
        });
      },
    });
  } catch (error) {
    logger.error("Upload token handler failed", { error: String(error) });
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withErrorTracking("Generate upload token", postHandler);
