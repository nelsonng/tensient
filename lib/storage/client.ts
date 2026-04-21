/**
 * Client-side storage abstraction for direct file uploads.
 *
 * Backed by Vercel Blob today; will be swapped for Cloudflare R2 (presigned
 * PUT URLs) without changing the API surface. Keep this module the only
 * client-side code that imports from `@vercel/blob`.
 */
import { upload } from "@vercel/blob/client";

export interface UploadFileOptions {
  /** Server route that issues upload credentials (uses `handleClientUpload`). */
  handleUploadUrl: string;
}

export interface UploadFileResult {
  /** Public URL of the uploaded object. */
  url: string;
}

/**
 * Upload a file directly from the browser to object storage. Streams the
 * bytes to the storage provider rather than through the Next.js server, so
 * size is bounded only by the constraints declared in `getConstraints` on
 * the corresponding `handleClientUpload` route.
 */
export async function uploadFile(
  pathname: string,
  file: File | Blob,
  opts: UploadFileOptions
): Promise<UploadFileResult> {
  const result = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: opts.handleUploadUrl,
  });
  return { url: result.url };
}
