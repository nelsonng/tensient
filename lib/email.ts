import { Resend } from "resend";
import { logger } from "@/lib/logger";

if (!process.env.RESEND_API_KEY) {
  logger.error("RESEND_API_KEY is not set -- all transactional emails will fail");
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sender address. Uses verified tensient.com domain.
 * Fallback to Resend onboarding address for local dev only.
 */
const FROM_ADDRESS = process.env.EMAIL_FROM || "Tensient <onboarding@resend.dev>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a transactional email via Resend.
 * Returns the Resend message ID on success, or null on failure.
 * Logs full error details on failure for debugging.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<string | null> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error("Resend API error", {
        errorName: error.name,
        errorMessage: error.message,
        to,
        subject,
        from: FROM_ADDRESS,
      });
      return null;
    }

    return data?.id ?? null;
  } catch (err: unknown) {
    logger.error("Resend send exception", {
      error: err instanceof Error ? err.message : "Unknown error",
      to,
      subject,
    });
    return null;
  }
}
