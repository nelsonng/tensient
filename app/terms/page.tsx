import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { MonoLabel } from "@/components/mono-label";
import { Footer } from "@/components/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | TENSIENT",
  description: "Terms governing your use of the Tensient platform.",
};

export default function TermsOfServicePage() {
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

        <GlitchText
          text="TERMS OF SERVICE"
          as="h1"
          className="text-3xl mb-3"
        />
        <MonoLabel className="block mb-12">
          Effective Date: February 9, 2026
        </MonoLabel>

        <div className="space-y-10 font-body text-base leading-relaxed text-muted">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of the
            Tensient web application at tensient.com (the
            &quot;Service&quot;), operated by Tensient
            (&quot;Tensient,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;). By creating an account or using the Service, you
            agree to these Terms.
          </p>

          {/* 1. Description of Service */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              1. Description of Service
            </h2>
            <p>
              Tensient is an AI-powered alignment tool for teams. The Service
              allows managers to define strategic goals, team members to submit
              updates, and AI to process those updates into alignment scores,
              action items, and coaching feedback. The Service is currently in
              early access.
            </p>
          </section>

          {/* 2. Accounts */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              2. Accounts
            </h2>
            <p>To use the Service, you must create an account. You agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide accurate and complete registration information</li>
              <li>
                Keep your password secure and not share it with anyone
              </li>
              <li>
                Notify us immediately if you suspect unauthorized access to your
                account
              </li>
              <li>
                Accept responsibility for all activity that occurs under your
                account
              </li>
            </ul>
            <p className="mt-3">
              Each account is for a single individual. You may not create
              multiple accounts or share account credentials.
            </p>
          </section>

          {/* 3. Free Trial and Usage Limits */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              3. Free Trial and Usage Limits
            </h2>
            <p>
              The Service currently offers a free trial with the following
              limits:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>20 free AI-processed operations per trial account</li>
              <li>50 operations per user per day</li>
              <li>Platform-wide capacity of 100 users</li>
            </ul>
            <p className="mt-3">
              These limits may change at any time. We reserve the right to
              modify, suspend, or discontinue the free trial at our discretion.
            </p>
          </section>

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              4. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                Use the Service for any unlawful purpose or in violation of
                these Terms
              </li>
              <li>
                Submit content that is abusive, harassing, defamatory, or
                otherwise objectionable
              </li>
              <li>
                Attempt to reverse-engineer, decompile, or disassemble any part
                of the Service
              </li>
              <li>
                Scrape, crawl, or use automated tools to extract data from the
                Service
              </li>
              <li>
                Interfere with or disrupt the Service or its infrastructure
              </li>
              <li>
                Impersonate another person or misrepresent your affiliation with
                any entity
              </li>
            </ul>
          </section>

          {/* 5. Your Content */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              5. Your Content
            </h2>
            <p className="mb-3">
              You retain ownership of all content you submit to the Service,
              including text inputs, voice recordings, and strategy documents
              (&quot;Your Content&quot;).
            </p>
            <p>
              By submitting content, you grant Tensient a limited,
              non-exclusive, worldwide license to process, analyze, store, and
              display Your Content solely for the purpose of providing the
              Service to you and your workspace. This includes sending Your
              Content to third-party AI providers (Anthropic, Google, Groq) for
              processing as described in our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          {/* 6. AI-Generated Content */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              6. AI-Generated Content
            </h2>
            <p>
              The Service uses artificial intelligence to generate alignment
              scores, sentiment analysis, action items, synthesized summaries,
              and coaching feedback (&quot;AI Output&quot;). AI Output is
              provided for informational purposes only and should not be relied
              upon as professional, legal, or managerial advice. AI Output may
              be inaccurate, incomplete, or biased. You are solely responsible
              for any decisions made based on AI Output.
            </p>
          </section>

          {/* 7. Intellectual Property */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              7. Intellectual Property
            </h2>
            <p>
              The Service, including its design, code, protocols, AI models
              integration, and branding, is owned by Tensient. Nothing in these
              Terms grants you any right to use Tensient&apos;s trademarks,
              logos, or branding without prior written consent.
            </p>
          </section>

          {/* 8. Termination */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              8. Termination
            </h2>
            <p className="mb-3">
              You may stop using the Service and request account deletion at any
              time by contacting us.
            </p>
            <p>
              We may suspend or terminate your access to the Service at any time
              if you violate these Terms, abuse the platform, or if we
              discontinue the Service. We will make reasonable efforts to notify
              you before termination, except where immediate action is required.
            </p>
          </section>

          {/* 9. Disclaimers */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              9. Disclaimers
            </h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
              AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. TENSIENT IS IN EARLY ACCESS AND MAY CONTAIN
              BUGS, ERRORS, OR INTERRUPTIONS. WE DO NOT WARRANT THAT THE
              SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              10. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TENSIENT SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL,
              ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL
              LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE
              SHALL NOT EXCEED THE AMOUNT YOU PAID TO TENSIENT IN THE TWELVE
              MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.
            </p>
          </section>

          {/* 11. Governing Law */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              11. Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of the State of California, without regard to its
              conflict of law provisions. Any disputes arising under these Terms
              shall be resolved in the courts located in California.
            </p>
          </section>

          {/* 12. Changes to These Terms */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              12. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. Changes will be
              posted on this page with an updated effective date. Your continued
              use of the Service after changes are posted constitutes acceptance
              of the updated Terms. If we make material changes, we will make
              reasonable efforts to notify you via the Service or email.
            </p>
          </section>

          {/* 13. Contact */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              13. Contact
            </h2>
            <p>
              If you have questions about these Terms, contact us at:{" "}
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
