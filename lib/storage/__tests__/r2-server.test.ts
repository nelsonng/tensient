import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  handleClientUpload,
  isConfigured,
} from "@/lib/storage/providers/r2/server";

const VALID_ENV = {
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "AKIA_TEST",
  R2_SECRET_ACCESS_KEY: "secret_test_key_value",
  R2_BUCKET: "tenscient-test",
  R2_PUBLIC_BASE_URL: "https://blob.example.com",
};

const ALLOWED = {
  allowedContentTypes: ["audio/webm", "image/png"] as const,
  maxSizeBytes: 10 * 1024 * 1024,
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/uploads/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("r2 server provider", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(VALID_ENV)) {
      vi.stubEnv(k, v);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isConfigured", () => {
    it("returns true when all env vars are present", () => {
      expect(isConfigured()).toBe(true);
    });

    it("returns false when any required env var is missing", () => {
      vi.stubEnv("R2_BUCKET", "");
      expect(isConfigured()).toBe(false);
    });
  });

  describe("handleClientUpload — sign", () => {
    it("returns presigned uploadUrl + publicUrl for an allowed request", async () => {
      const res = await handleClientUpload({
        request: jsonRequest({
          action: "sign",
          pathname: "audio/ws-1/clip.webm",
          contentType: "audio/webm",
          size: 1234,
        }),
        getConstraints: () => ALLOWED,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        uploadUrl: string;
        publicUrl: string;
        headers: Record<string, string>;
      };

      expect(body.publicUrl).toBe(
        "https://blob.example.com/audio/ws-1/clip.webm"
      );
      expect(body.uploadUrl).toContain(
        "acct123.r2.cloudflarestorage.com/tenscient-test/audio/ws-1/clip.webm"
      );
      expect(body.uploadUrl).toContain("X-Amz-Signature=");
      expect(body.uploadUrl).toContain("X-Amz-Expires=600");
      expect(body.headers["content-type"]).toBe("audio/webm");
    });

    it("rejects disallowed content types", async () => {
      const res = await handleClientUpload({
        request: jsonRequest({
          action: "sign",
          pathname: "audio/ws-1/clip.exe",
          contentType: "application/x-msdownload",
          size: 100,
        }),
        getConstraints: () => ALLOWED,
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/not allowed/i);
    });

    it("rejects files over the size limit", async () => {
      const res = await handleClientUpload({
        request: jsonRequest({
          action: "sign",
          pathname: "audio/ws-1/big.webm",
          contentType: "audio/webm",
          size: ALLOWED.maxSizeBytes + 1,
        }),
        getConstraints: () => ALLOWED,
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/too large/i);
    });

    it("rejects requests with missing pathname", async () => {
      const res = await handleClientUpload({
        request: jsonRequest({
          action: "sign",
          contentType: "audio/webm",
          size: 100,
        }),
        getConstraints: () => ALLOWED,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("handleClientUpload — complete", () => {
    it("invokes onUploadCompleted with the public URL", async () => {
      const onUploadCompleted = vi.fn();
      const res = await handleClientUpload({
        request: jsonRequest({
          action: "complete",
          pathname: "audio/ws-1/clip.webm",
          publicUrl: "https://blob.example.com/audio/ws-1/clip.webm",
        }),
        getConstraints: () => ALLOWED,
        onUploadCompleted,
      });

      expect(res.status).toBe(200);
      expect(onUploadCompleted).toHaveBeenCalledWith({
        url: "https://blob.example.com/audio/ws-1/clip.webm",
        pathname: "audio/ws-1/clip.webm",
      });
    });

    it("succeeds without an onUploadCompleted hook", async () => {
      const res = await handleClientUpload({
        request: jsonRequest({
          action: "complete",
          pathname: "p",
          publicUrl: "u",
        }),
        getConstraints: () => ALLOWED,
      });
      expect(res.status).toBe(200);
    });
  });

  describe("handleClientUpload — misc", () => {
    it("returns 503 when R2 is not configured", async () => {
      vi.stubEnv("R2_ACCESS_KEY_ID", "");
      const res = await handleClientUpload({
        request: jsonRequest({
          action: "sign",
          pathname: "x",
          contentType: "audio/webm",
          size: 1,
        }),
        getConstraints: () => ALLOWED,
      });
      expect(res.status).toBe(503);
    });

    it("rejects unknown actions", async () => {
      const res = await handleClientUpload({
        request: jsonRequest({ action: "delete" }),
        getConstraints: () => ALLOWED,
      });
      expect(res.status).toBe(400);
    });
  });
});
