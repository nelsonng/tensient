/**
 * Cloudflare R2 client-side implementation.
 *
 * Three-step flow:
 *   1. POST { action: "sign", ... } to handleUploadUrl → presigned PUT URL
 *   2. PUT the file body directly to R2 (no auth header — sig is in query)
 *   3. POST { action: "complete", ... } to handleUploadUrl (best-effort)
 */
import type { UploadFileOptions, UploadFileResult } from "../../types";

interface SignResponse {
  uploadUrl: string;
  publicUrl: string;
  headers: Record<string, string>;
}

export async function uploadFile(
  pathname: string,
  file: File | Blob,
  opts: UploadFileOptions
): Promise<UploadFileResult> {
  const contentType = file.type || "application/octet-stream";
  const size = file.size;

  // ── 1. Get presigned PUT URL ─────────────────────────────────────
  const signRes = await fetch(opts.handleUploadUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "sign",
      pathname,
      contentType,
      size,
    }),
  });

  if (!signRes.ok) {
    const text = await signRes.text().catch(() => "");
    throw new Error(
      `Failed to get upload URL (${signRes.status})${text ? `: ${text}` : ""}`
    );
  }

  const { uploadUrl, publicUrl, headers } = (await signRes.json()) as SignResponse;

  // ── 2. PUT the file body directly to R2 ──────────────────────────
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers,
  });

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(`Upload failed (${putRes.status})${text ? `: ${text}` : ""}`);
  }

  // ── 3. Notify completion (best-effort — don't block on errors) ──
  void fetch(opts.handleUploadUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      pathname,
      publicUrl,
    }),
  }).catch(() => {
    // Non-critical -- the upload itself succeeded
  });

  return { url: publicUrl };
}
