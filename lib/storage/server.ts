/**
 * Server-side storage abstraction for client-direct uploads.
 *
 * Dispatches to the configured provider (Vercel Blob or Cloudflare R2)
 * based on `NEXT_PUBLIC_STORAGE_PROVIDER`. Route handlers should never
 * import from `lib/storage/providers/*` directly.
 */
import {
  getStorageProviderName,
  type HandleClientUploadOptions,
} from "./types";
import * as vercelBlob from "./providers/vercel-blob/server";
import * as r2 from "./providers/r2/server";

export type {
  HandleClientUploadOptions,
  UploadConstraints,
  UploadCompletedInfo,
} from "./types";

export async function handleClientUpload(
  opts: HandleClientUploadOptions
): Promise<Response> {
  const provider = getStorageProviderName();
  if (provider === "r2") {
    return r2.handleClientUpload(opts);
  }
  return vercelBlob.handleClientUpload(opts);
}

/**
 * True when the underlying storage provider has all required env vars set.
 * Use to fail fast with a friendly error before attempting an upload.
 */
export function isStorageConfigured(): boolean {
  const provider = getStorageProviderName();
  if (provider === "r2") {
    return r2.isConfigured();
  }
  return vercelBlob.isConfigured();
}
