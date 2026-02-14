import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _anthropic;
}

/**
 * Extract text content from a file URL based on its content type.
 * - PDFs: uses pdf-parse to extract text
 * - Images: uses Claude vision API to describe/transcribe
 * - Text/Markdown: fetches raw content
 * Returns extracted text or null on failure.
 */
export async function extractTextFromFile(
  fileUrl: string,
  contentType: string
): Promise<string | null> {
  try {
    if (contentType === "application/pdf") {
      return await extractPdfText(fileUrl);
    }

    if (contentType.startsWith("image/")) {
      return await extractImageText(fileUrl, contentType);
    }

    if (
      contentType === "text/plain" ||
      contentType === "text/markdown"
    ) {
      const res = await fetch(fileUrl);
      if (!res.ok) return null;
      return await res.text();
    }

    logger.warn("Unsupported content type for text extraction", { contentType });
    return null;
  } catch (error) {
    logger.error("Text extraction failed", { fileUrl, contentType, error: String(error) });
    return null;
  }
}

async function extractPdfText(fileUrl: string): Promise<string | null> {
  const res = await fetch(fileUrl);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return data.text?.trim() || null;
}

async function extractImageText(
  fileUrl: string,
  contentType: string
): Promise<string | null> {
  const anthropic = getAnthropic();

  // Map content type to Anthropic's expected media type
  const mediaType = contentType as "image/png" | "image/jpeg" | "image/webp" | "image/gif";

  // Fetch image as base64
  const res = await fetch(fileUrl);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extract all text content from this image. If it's a screenshot of an application, document, or conversation, transcribe all visible text. If it's a diagram or chart, describe it thoroughly. Return only the extracted content, no preamble.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : null;
}
