/**
 * Vercel Blob server-side implementation. Wraps `@vercel/blob/client`'s
 * `handleUpload` so route handlers don't need to know the wire protocol.
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import type { HandleClientUploadOptions } from "../../types";

export function isConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

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
