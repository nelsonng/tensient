interface ResetPasswordEmailProps {
  resetUrl: string;
  firstName?: string | null;
}

/**
 * Generates HTML for the password reset email.
 * Plain, functional design -- no heavy styling.
 */
export function resetPasswordEmailHtml({ resetUrl, firstName }: ResetPasswordEmailProps): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #e0e0e0; padding: 40px 20px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto;">
    <h1 style="font-size: 14px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #00ffcc; margin-bottom: 32px;">
      TENSIENT
    </h1>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
      ${greeting}
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      We received a request to reset your password. Click the button below to choose a new one.
    </p>
    
    <a href="${resetUrl}" style="display: inline-block; background-color: #00ffcc; color: #0a0a0a; font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; padding: 14px 32px; border-radius: 4px;">
      RESET PASSWORD
    </a>
    
    <p style="font-size: 14px; line-height: 1.6; color: #888; margin-top: 32px;">
      This link expires in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;" />
    
    <p style="font-size: 12px; color: #555;">
      Tensient
    </p>
  </div>
</body>
</html>
`.trim();
}
