/**
 * Vercel Blob client-side implementation. Wraps `@vercel/blob/client`'s
 * `upload()` so callers don't depend on the package directly.
 */
import { upload } from "@vercel/blob/client";
import type { UploadFileOptions, UploadFileResult } from "../../types";

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
