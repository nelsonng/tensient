/**
 * Server-side storage abstraction for client-direct uploads.
 *
 * Backed by Vercel Blob today; will be swapped for Cloudflare R2 (presigned
 * PUT URLs) without changing the API surface. Keep this module the only
 * server-side code that imports from `@vercel/blob`.
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export interface UploadConstraints {
  /** MIME types the upload endpoint will accept. */
  readonly allowedContentTypes: readonly string[];
  /** Hard size limit in bytes. */
  readonly maxSizeBytes: number;
}

export interface HandleClientUploadOptions {
  /** The incoming Next.js Request. */
  request: Request;
  /**
   * Called per upload to determine the constraints for a given pathname.
   * Throw to reject the upload.
   */
  getConstraints: (
    pathname: string
  ) => Promise<UploadConstraints> | UploadConstraints;
  /**
   * Optional hook invoked after the client finishes uploading. For Vercel
   * Blob this fires via webhook; for R2 it will fire from a follow-up
   * request from the client after the PUT succeeds.
   */
  onUploadCompleted?: (info: {
    url: string;
    pathname: string;
  }) => Promise<void> | void;
}

/**
 * Handle a client-direct upload token request. The shape of the request
 * body and the JSON response are an implementation detail of the storage
 * provider — clients should always call `uploadFile` from
 * `lib/storage/client` rather than constructing requests manually.
 */
export async function handleClientUpload(
  opts: HandleClientUploadOptions
): Promise<Response> {
  const body = (await opts.request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request: opts.request,
    onBeforeGenerateToken: async (pathname) => {
      const constraints = await opts.getConstraints(pathname);
      return {
        allowedContentTypes: [...constraints.allowedContentTypes],
        maximumSizeInBytes: constraints.maxSizeBytes,
      };
    },
    onUploadCompleted: opts.onUploadCompleted
      ? async ({ blob }) => {
          await opts.onUploadCompleted!({
            url: blob.url,
            pathname: blob.pathname,
          });
        }
      : undefined,
  });

  return NextResponse.json(jsonResponse);
}

/**
 * True when the underlying storage provider is configured. Use to fail fast
 * with a friendly error before attempting an upload.
 */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
