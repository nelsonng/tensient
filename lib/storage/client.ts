/**
 * Client-side storage abstraction for direct file uploads.
 *
 * Dispatches to the configured provider (Vercel Blob or Cloudflare R2)
 * based on `NEXT_PUBLIC_STORAGE_PROVIDER`. Browser components should never
 * import from `lib/storage/providers/*` directly.
 */
import {
  getStorageProviderName,
  type UploadFileOptions,
  type UploadFileResult,
} from "./types";
import * as vercelBlob from "./providers/vercel-blob/client";
import * as r2 from "./providers/r2/client";

export type { UploadFileOptions, UploadFileResult } from "./types";

export async function uploadFile(
  pathname: string,
  file: File | Blob,
  opts: UploadFileOptions
): Promise<UploadFileResult> {
  const provider = getStorageProviderName();
  if (provider === "r2") {
    return r2.uploadFile(pathname, file, opts);
  }
  return vercelBlob.uploadFile(pathname, file, opts);
}
