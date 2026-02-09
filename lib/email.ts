import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Default sender address.
 * Uses Resend's onboarding address until tensient.com domain is verified in Resend.
 * Once verified, switch to: "Tensient <noreply@tensient.com>"
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
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<string | null> {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  if (error) {
    // Caller should handle logging via lib/logger.ts
    return null;
  }

  return data?.id ?? null;
}
