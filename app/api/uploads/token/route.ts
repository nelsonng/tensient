import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";

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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.error("BLOB_READ_WRITE_TOKEN is not configured");
    return NextResponse.json(
      { error: "File upload is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const isAudio = pathname.startsWith("audio/");
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: isAudio ? MAX_AUDIO_SIZE : MAX_FILE_SIZE,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        logger.info("File upload completed", {
          url: blob.url,
          pathname: blob.pathname,
          userId: session.user?.id,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    logger.error("Upload token handler failed", { error: String(error) });
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withErrorTracking("Generate upload token", postHandler);
