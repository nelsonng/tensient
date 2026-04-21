/**
 * Cloudflare R2 server-side implementation.
 *
 * Wire protocol (JSON over POST to the same `handleUploadUrl`):
 *   { action: "sign", pathname, contentType, size }
 *     → { uploadUrl, publicUrl, headers }
 *   { action: "complete", pathname, publicUrl }
 *     → { ok: true }
 *
 * The browser PUTs the file body directly to `uploadUrl` (a presigned R2
 * URL), then optionally calls back with `action: "complete"` to trigger any
 * server-side bookkeeping registered via `onUploadCompleted`.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID         — Cloudflare account ID
 *   R2_ACCESS_KEY_ID      — R2 token access key
 *   R2_SECRET_ACCESS_KEY  — R2 token secret
 *   R2_BUCKET             — bucket name
 *   R2_PUBLIC_BASE_URL    — public URL prefix (e.g. https://blob.tensient.com)
 */
import { AwsClient } from "aws4fetch";
import { NextResponse } from "next/server";
import type {
  HandleClientUploadOptions,
  UploadConstraints,
} from "../../types";

const PRESIGN_TTL_SECONDS = 60 * 10; // 10 min — generous buffer for slow uploads

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function isConfigured(): boolean {
  return readConfig() !== null;
}

function publicUrlFor(config: R2Config, pathname: string): string {
  const base = config.publicBaseUrl.replace(/\/$/, "");
  const key = pathname.replace(/^\//, "");
  return `${base}/${key}`;
}

async function presignPut(
  config: R2Config,
  pathname: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });

  const key = pathname.replace(/^\//, "");
  const url = new URL(
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`
  );
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));

  const signed = await aws.sign(url.toString(), {
    method: "PUT",
    headers: { "content-type": contentType },
    aws: { signQuery: true },
  });

  return {
    uploadUrl: signed.url,
    publicUrl: publicUrlFor(config, pathname),
  };
}

interface SignBody {
  action: "sign";
  pathname: string;
  contentType: string;
  size: number;
}

interface CompleteBody {
  action: "complete";
  pathname: string;
  publicUrl: string;
}

type RequestBody = SignBody | CompleteBody;

function isStringField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function violatesConstraint(
  contentType: string,
  size: number,
  constraints: UploadConstraints
): string | null {
  if (!constraints.allowedContentTypes.includes(contentType)) {
    return `Content type "${contentType}" is not allowed.`;
  }
  if (!Number.isFinite(size) || size <= 0) {
    return "Invalid file size.";
  }
  if (size > constraints.maxSizeBytes) {
    return `File too large (${size} bytes, max ${constraints.maxSizeBytes}).`;
  }
  return null;
}

export async function handleClientUpload(
  opts: HandleClientUploadOptions
): Promise<Response> {
  const config = readConfig();
  if (!config) {
    return NextResponse.json(
      { error: "R2 storage is not configured." },
      { status: 503 }
    );
  }

  const body = (await opts.request.json()) as RequestBody;

  if (body.action === "sign") {
    if (!isStringField(body.pathname) || !isStringField(body.contentType)) {
      return NextResponse.json(
        { error: "Missing pathname or contentType." },
        { status: 400 }
      );
    }
    const constraints = await opts.getConstraints(body.pathname);
    const violation = violatesConstraint(body.contentType, body.size, constraints);
    if (violation) {
      return NextResponse.json({ error: violation }, { status: 400 });
    }

    const { uploadUrl, publicUrl } = await presignPut(
      config,
      body.pathname,
      body.contentType
    );

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      headers: { "content-type": body.contentType },
    });
  }

  if (body.action === "complete") {
    if (!isStringField(body.pathname) || !isStringField(body.publicUrl)) {
      return NextResponse.json(
        { error: "Missing pathname or publicUrl." },
        { status: 400 }
      );
    }
    if (opts.onUploadCompleted) {
      await opts.onUploadCompleted({
        url: body.publicUrl,
        pathname: body.pathname,
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
