/**
 * Shared types and provider selection for the storage abstraction.
 *
 * This module is import-safe from both client and server bundles — it does
 * not pull in any provider-specific code. Provider implementations live in
 * `lib/storage/providers/` and are dispatched to from `server.ts` / `client.ts`.
 */

export type StorageProviderName = "vercel-blob" | "r2";

export interface UploadConstraints {
  /** MIME types the upload endpoint will accept. */
  readonly allowedContentTypes: readonly string[];
  /** Hard size limit in bytes. */
  readonly maxSizeBytes: number;
}

export interface UploadCompletedInfo {
  url: string;
  pathname: string;
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
   * Blob this fires via webhook; for R2 it fires from a follow-up request
   * from the client after the PUT succeeds.
   */
  onUploadCompleted?: (info: UploadCompletedInfo) => Promise<void> | void;
}

export interface UploadFileOptions {
  /** Server route that issues upload credentials. */
  handleUploadUrl: string;
}

export interface UploadFileResult {
  /** Public URL of the uploaded object. */
  url: string;
}

/**
 * The storage provider in use. Read from `NEXT_PUBLIC_STORAGE_PROVIDER` so
 * it's available identically in both client and server bundles. Defaults to
 * `vercel-blob` to preserve existing behavior when unset.
 */
export function getStorageProviderName(): StorageProviderName {
  const raw = process.env.NEXT_PUBLIC_STORAGE_PROVIDER;
  if (raw === "r2") return "r2";
  return "vercel-blob";
}
