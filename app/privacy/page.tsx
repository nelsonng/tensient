import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { MonoLabel } from "@/components/mono-label";
import { Footer } from "@/components/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | TENSIENT",
  description: "How Tensient collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 pt-24 pb-24">
        <div className="mb-4">
          <Link
            href="/"
            className="font-mono text-sm uppercase tracking-widest text-muted hover:text-primary transition-colors"
          >
            &larr; Back to Home
          </Link>
        </div>

        <GlitchText text="PRIVACY POLICY" as="h1" className="text-3xl mb-3" />
        <MonoLabel className="block mb-12">
          Effective Date: February 9, 2026
        </MonoLabel>

        <div className="space-y-10 font-body text-base leading-relaxed text-muted">
          <p>
            This Privacy Policy describes how Tensient
            (&quot;Tensient,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) collects, uses, and protects information when you
            use our web application at tensient.com (the
            &quot;Service&quot;).
          </p>

          {/* 1. Information We Collect */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              1. Information We Collect
            </h2>

            <h3 className="font-display text-base font-bold uppercase tracking-tight text-foreground mb-2">
              Account Information
            </h3>
            <p className="mb-4">
              When you create an account, we collect your first name, last name,
              email address, and a password. Your password is hashed using bcrypt
              before storage and is never stored in plain text.
            </p>

            <h3 className="font-display text-base font-bold uppercase tracking-tight text-foreground mb-2">
              User-Generated Content
            </h3>
            <p className="mb-4">
              We collect the text and voice content you submit through the
              Service, including strategy inputs (&quot;Downloads&quot;) and
              update submissions (&quot;Unloads&quot;). If you use voice input,
              your audio recording is stored and transcribed.
            </p>

            <h3 className="font-display text-base font-bold uppercase tracking-tight text-foreground mb-2">
              AI-Generated Data
            </h3>
            <p className="mb-4">
              When your content is processed, our AI generates additional data
              including alignment scores, sentiment scores, action items,
              synthesized summaries, coaching feedback, and vector embeddings.
              This data is stored alongside your original content.
            </p>

            <h3 className="font-display text-base font-bold uppercase tracking-tight text-foreground mb-2">
              Usage Data
            </h3>
            <p>
              We log the number of operations you perform, token counts, and
              estimated processing costs to enforce usage limits and manage
              platform capacity. We also track engagement metrics such as streak
              counts and traction scores as part of the Service&apos;s
              functionality.
            </p>
          </section>

          {/* 2. How We Use Your Information */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              2. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>
                Process your content through AI to generate alignment scores,
                action items, and coaching feedback
              </li>
              <li>Authenticate your identity and secure your account</li>
              <li>Enforce usage limits and platform capacity</li>
              <li>
                Communicate with you about the Service (e.g., account issues)
              </li>
            </ul>
          </section>

          {/* 3. Third-Party Services */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              3. Third-Party Services
            </h2>
            <p className="mb-4">
              To operate the Service, your data is processed by the following
              third-party providers:
            </p>

            <ul className="space-y-3">
              <li>
                <span className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  Google Gemini
                </span>{" "}
                &mdash; Your text content is sent to Google&apos;s Gemini API
                for AI analysis, including sentiment detection, action item
                extraction, and vector embedding generation.
              </li>
              <li>
                <span className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  Groq
                </span>{" "}
                &mdash; If you use voice input, your audio file is sent to Groq
                for transcription using their Whisper model.
              </li>
              <li>
                <span className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  Vercel
                </span>{" "}
                &mdash; The Service is hosted on Vercel. Audio files are stored
                using Vercel Blob storage.
              </li>
              <li>
                <span className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  Neon
                </span>{" "}
                &mdash; All structured data (accounts, content, scores) is
                stored in a Neon-hosted PostgreSQL database.
              </li>
            </ul>

            <p className="mt-4">
              Each of these providers processes data under their own privacy
              policies. We do not sell, rent, or share your personal information
              with any other third parties.
            </p>
          </section>

          {/* 4. Cookies and Tracking */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              4. Cookies and Tracking
            </h2>
            <p>
              The Service uses a single session cookie (a JWT token) to keep you
              signed in. We do not use any analytics cookies, tracking pixels,
              or third-party advertising scripts. We do not track your activity
              across other websites.
            </p>
          </section>

          {/* 5. Data Retention */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              5. Data Retention
            </h2>
            <p>
              Your data is retained for as long as your account is active. If
              you request account deletion, we will delete your personal
              information and user-generated content within 30 days. Some
              anonymized or aggregated data may be retained for operational
              purposes.
            </p>
          </section>

          {/* 6. Your Rights */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              6. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <span className="text-foreground">Access</span> the personal
                data we hold about you
              </li>
              <li>
                <span className="text-foreground">Correct</span> inaccurate
                personal data
              </li>
              <li>
                <span className="text-foreground">Delete</span> your account
                and associated data
              </li>
              <li>
                <span className="text-foreground">Export</span> your
                user-generated content
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at the address below.
            </p>
          </section>

          {/* 7. Security */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              7. Security
            </h2>
            <p>
              We take reasonable measures to protect your information, including
              bcrypt password hashing, HTTPS encryption for all data in transit,
              and JWT-based session management. However, no method of
              transmission over the internet is 100% secure, and we cannot
              guarantee absolute security.
            </p>
          </section>

          {/* 8. Children */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              8. Children&apos;s Privacy
            </h2>
            <p>
              The Service is not intended for use by anyone under the age of 13.
              We do not knowingly collect personal information from children
              under 13. If we learn we have collected such information, we will
              delete it promptly.
            </p>
          </section>

          {/* 9. Changes */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will
              be posted on this page with an updated effective date. Your
              continued use of the Service after changes are posted constitutes
              acceptance of the updated policy.
            </p>
          </section>

          {/* 10. Contact */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              10. Contact
            </h2>
            <p>
              If you have questions about this Privacy Policy or want to
              exercise your data rights, contact us at:{" "}
              <a
                href="mailto:hello@tensient.com"
                className="text-primary hover:underline"
              >
                hello@tensient.com
              </a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
