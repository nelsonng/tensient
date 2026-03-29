import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MonoLabel } from "@/components/mono-label";

const ENDPOINT = "https://tensient.com/api/feedback/ingest";

const curlExample = `curl -X POST ${ENDPOINT} \\
  -H "Authorization: Bearer tns_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "category": "bug_report",
    "subject": "Payment fails at checkout",
    "description": "Clicking Pay does nothing after entering card details. No error shown.",
    "submitter": {
      "email": "user@example.com",
      "name": "Alex Smith",
      "externalId": "usr_123",
      "isAuthenticated": true
    },
    "context": {
      "url": "https://mygame.com/checkout",
      "pageTitle": "Checkout",
      "locale": "en-US",
      "timezone": "America/New_York",
      "browser": { "name": "Chrome", "version": "124.0" },
      "os": { "name": "macOS", "version": "14.4" },
      "screen": { "width": 1440, "height": 900, "viewportWidth": 1440, "viewportHeight": 789 },
      "hardware": { "webdriver": false }
    },
    "customContext": {
      "gameSessionId": "sess_abc123",
      "transactionId": "txn_xyz789"
    },
    "tags": ["checkout", "payments"]
  }'`;

const jsExample = `const response = await fetch("${ENDPOINT}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer tns_YOUR_KEY_HERE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    category: "bug_report",
    subject: "Payment fails at checkout",
    description: "Clicking Pay does nothing after entering card details.",
    submitter: {
      email: "user@example.com",
      externalId: "usr_123",
      isAuthenticated: true,
    },
    context: {
      url: window.location.href,
      pageTitle: document.title,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      screen: {
        width: screen.width,
        height: screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      hardware: {
        cpuCores: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
        touchSupport: navigator.maxTouchPoints > 0,
        webdriver: navigator.webdriver,
      },
      network: {
        online: navigator.onLine,
        effectiveType: (navigator as any).connection?.effectiveType,
      },
    },
    customContext: {
      gameSessionId: "sess_abc123",
    },
  }),
});

const result = await response.json();
// result.trackingId  — save this to show the user their ticket link
// result.trackingUrl — e.g. https://tensient.com/feedback/track/fb_a1b2c3`;

const pythonExample = `import requests

response = requests.post(
    "${ENDPOINT}",
    headers={
        "Authorization": "Bearer tns_YOUR_KEY_HERE",
        "Content-Type": "application/json",
    },
    json={
        "category": "bug_report",
        "subject": "Payment fails at checkout",
        "description": "Clicking Pay does nothing after entering card details.",
        "submitter": {
            "email": "user@example.com",
            "externalId": "usr_123",
            "isAuthenticated": True,
        },
        "context": {
            "url": "https://mygame.com/checkout",
            "pageTitle": "Checkout",
        },
        "customContext": {
            "gameSessionId": "sess_abc123",
            "transactionId": "txn_xyz789",
        },
    },
)

data = response.json()
tracking_id = data["trackingId"]   # e.g. "fb_a1b2c3d4e5f6"
tracking_url = data["trackingUrl"] # share with the user`;

const successResponse = `// HTTP 201
{
  "id": "uuid-of-the-submission",
  "trackingId": "fb_a1b2c3d4e5f6",
  "trackingUrl": "https://tensient.com/feedback/track/fb_a1b2c3d4e5f6",
  "status": "new",
  "createdAt": "2026-03-28T10:00:00.000Z"
}`;

const errorResponses = `// 400 — Validation error
{ "error": "category must be one of: bug_report, feature_request, help_request, urgent_issue" }
{ "error": "subject is required." }
{ "error": "description must be 10,000 characters or fewer." }

// 401 — Auth error
{ "error": "Missing API key. Use Authorization: Bearer tns_... or X-API-Key header." }
{ "error": "Invalid or revoked API key." }

// 429 — Rate limit
{ "error": "Rate limit exceeded. Max 60 submissions per minute per API key." }`;

const npsExample = `{
  "category": "help_request",
  "subject": "Post-session NPS",
  "description": "Automated NPS capture after game session",
  "submitter": { "externalId": "usr_123", "isAuthenticated": true },
  "rating": {
    "value": 8,
    "scale": 10,
    "type": "nps",
    "label": "How likely are you to recommend us?"
  }
}`;

const starsExample = `{
  "category": "help_request",
  "subject": "Support ticket rating",
  "description": "Post-resolution CSAT",
  "submitter": { "externalId": "usr_456", "isAuthenticated": true },
  "rating": { "value": 4, "scale": 5, "type": "stars" }
}`;

const multiQuestionExample = `{
  "category": "help_request",
  "subject": "Post-session survey",
  "description": "Automated capture after game session ends",
  "submitter": { "externalId": "usr_789", "isAuthenticated": true },
  "rating": { "value": 8, "scale": 10, "type": "nps" },
  "responses": [
    { "questionId": "nps",    "type": "nps",    "value": 8, "scale": 10 },
    { "questionId": "nps_reason", "type": "text",
      "value": "Love the game variety but withdrawals are slow" },
    { "questionId": "primary_issue", "type": "choice",
      "value": "withdrawal_speed",
      "options": ["game_selection", "withdrawal_speed", "customer_support", "bonuses"] }
  ]
}`;

const categories = [
  {
    value: "bug_report",
    label: "Bug Report",
    description: "Something is not working as expected. Use this for broken features, errors, or unexpected behavior.",
  },
  {
    value: "feature_request",
    label: "Feature Request",
    description: "A suggestion for something new or an improvement to existing functionality.",
  },
  {
    value: "help_request",
    label: "Help Request",
    description: "The user needs assistance or has a question about how something works.",
  },
  {
    value: "urgent_issue",
    label: "Urgent Issue",
    description: "A critical problem requiring immediate attention — data loss, security concerns, complete outages.",
  },
];

export default function FeedbackApiDocsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[950px] px-6 pt-28 pb-24">
        <a
          href="/docs"
          className="mb-4 inline-block font-mono text-xs text-muted transition-colors hover:text-primary"
        >
          ← BACK TO DOCS
        </a>
        <MonoLabel className="mb-3 block text-primary">DOCS / FEEDBACK API</MonoLabel>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-4">
          Feedback Ingestion API
        </h1>
        <p className="font-body text-base text-muted max-w-[720px] mb-10">
          A single POST endpoint that lets any user on your platform submit feedback directly
          into your Tensient workspace. Captures rich browser and device context automatically.
          Returns a tracking ID the user can save to follow their ticket.
        </p>

        {/* Endpoint */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Endpoint
          </h2>
          <div className="rounded-lg border border-border bg-panel p-4 space-y-2">
            <p className="font-mono text-xs text-muted">POST</p>
            <code className="block font-mono text-sm text-foreground">{ENDPOINT}</code>
            <p className="font-body text-sm text-muted mt-2">
              Authenticated via your Tensient API key. Generate keys in{" "}
              <a href="/dashboard" className="text-primary hover:text-primary/80 transition-colors">
                Settings → Developer
              </a>
              .
            </p>
          </div>
        </section>

        {/* Authentication */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Authentication
          </h2>
          <div className="rounded-lg border border-border bg-panel p-4 space-y-3">
            <p className="font-body text-sm text-muted">
              Pass your API key using either header format:
            </p>
            <div>
              <p className="font-mono text-xs text-muted mb-1">Option A — Bearer token</p>
              <code className="block font-mono text-xs text-foreground bg-background/60 px-3 py-2 rounded">
                Authorization: Bearer tns_YOUR_KEY_HERE
              </code>
            </div>
            <div>
              <p className="font-mono text-xs text-muted mb-1">Option B — X-API-Key header</p>
              <code className="block font-mono text-xs text-foreground bg-background/60 px-3 py-2 rounded">
                X-API-Key: tns_YOUR_KEY_HERE
              </code>
            </div>
            <p className="font-body text-sm text-muted">
              API keys are workspace-scoped. All submissions go into the workspace associated with
              the key used.
            </p>

            {/* Key type callout */}
            <div className="rounded-md border border-border bg-background/60 divide-y divide-border">
              <div className="px-4 py-3 flex gap-3 items-start">
                <code className="font-mono text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded shrink-0 mt-0.5">
                  tns_pub_...
                </code>
                <div>
                  <p className="font-mono text-xs text-foreground mb-1">Public key — safe for client-side use</p>
                  <p className="font-body text-sm text-muted">
                    Can be embedded in browser JavaScript bundles or mobile apps. Requires an
                    origin allowlist — requests are only accepted from the registered domains you
                    configure in Settings → Developer. Configure your domains before deploying.
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 flex gap-3 items-start">
                <code className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 mt-0.5">
                  tns_...
                </code>
                <div>
                  <p className="font-mono text-xs text-foreground mb-1">Secret key — server-side only</p>
                  <p className="font-body text-sm text-muted">
                    Full access, no origin restriction. Must never be embedded in frontend code,
                    mobile apps, or any environment where it could be extracted. Use only from
                    your backend or server-side functions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Categories
          </h2>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.value}
                className="rounded-lg border border-border bg-panel p-4 flex gap-4"
              >
                <code className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded h-fit shrink-0">
                  {cat.value}
                </code>
                <div>
                  <p className="font-mono text-xs text-foreground mb-1">{cat.label}</p>
                  <p className="font-body text-sm text-muted">{cat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Request payload */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Request Payload
          </h2>
          <div className="rounded-lg border border-border bg-panel p-4 space-y-4">
            <div>
              <p className="font-mono text-xs text-foreground mb-2">Required fields</p>
              <div className="space-y-2">
                {[
                  { field: "category", type: "string", note: 'One of the four category values above.' },
                  { field: "subject", type: "string", note: 'Brief title. Max 200 characters.' },
                  { field: "description", type: "string", note: 'Full description of the issue or request. Max 10,000 characters.' },
                ].map(({ field, type, note }) => (
                  <div key={field} className="flex gap-3 items-start">
                    <code className="font-mono text-xs text-primary shrink-0 w-28">{field}</code>
                    <code className="font-mono text-xs text-muted shrink-0 w-14">{type}</code>
                    <p className="font-body text-xs text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-xs text-foreground mb-2">submitter <span className="text-muted">(optional object)</span></p>
              <div className="space-y-2 pl-4 border-l border-border">
                {[
                  { field: "email", type: "string", note: "Submitter's email address." },
                  { field: "name", type: "string", note: "Submitter's display name." },
                  { field: "externalId", type: "string", note: "Your platform's user ID. Useful for correlating with your own user data." },
                  { field: "isAuthenticated", type: "boolean", note: "Whether the user was logged in on your platform when submitting." },
                  { field: "type", type: "string", note: '"human" (default) or "ai_agent" — use ai_agent when submitting programmatically from an AI system.' },
                ].map(({ field, type, note }) => (
                  <div key={field} className="flex gap-3 items-start">
                    <code className="font-mono text-xs text-primary shrink-0 w-28">{field}</code>
                    <code className="font-mono text-xs text-muted shrink-0 w-14">{type}</code>
                    <p className="font-body text-xs text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-xs text-foreground mb-2">context <span className="text-muted">(optional object — captured browser environment)</span></p>
              <div className="space-y-2 pl-4 border-l border-border">
                {[
                  { field: "url", type: "string", note: "Current page URL." },
                  { field: "referrer", type: "string", note: "Referring page URL." },
                  { field: "pageTitle", type: "string", note: "document.title of the current page." },
                  { field: "locale", type: "string", note: "navigator.language — e.g. \"en-US\"." },
                  { field: "timezone", type: "string", note: "IANA timezone — e.g. \"America/New_York\"." },
                  { field: "userAgent", type: "string", note: "navigator.userAgent. Captured server-side as fallback." },
                  { field: "browser", type: "object", note: "{ name, version, engine, engineVersion }" },
                  { field: "os", type: "object", note: "{ name, version }" },
                  { field: "screen", type: "object", note: "{ width, height, viewportWidth, viewportHeight, pixelRatio, colorDepth, orientation }" },
                  { field: "hardware", type: "object", note: "{ cpuCores, deviceMemory, maxTouchPoints, touchSupport, webdriver } — webdriver:true is a fraud signal." },
                  { field: "network", type: "object", note: "{ effectiveType, downlink, rtt, online }" },
                  { field: "performance", type: "object", note: "{ memory, navigation, paint: { firstPaint, firstContentfulPaint } }" },
                  { field: "errors", type: "array", note: "Console errors: [{ message, source, lineno, colno, stack, timestamp }]" },
                  { field: "fingerprint", type: "object", note: "{ canvasHash, webglRenderer, webglVendor } — for device clustering and fraud detection." },
                ].map(({ field, type, note }) => (
                  <div key={field} className="flex gap-3 items-start">
                    <code className="font-mono text-xs text-primary shrink-0 w-28">{field}</code>
                    <code className="font-mono text-xs text-muted shrink-0 w-14">{type}</code>
                    <p className="font-body text-xs text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-xs text-foreground mb-2">Other fields</p>
              <div className="space-y-2">
                {[
                  { field: "customContext", type: "object", note: "Arbitrary key-value metadata from your platform. Attach game session IDs, transaction IDs, feature flags, A/B test variants, etc." },
                  { field: "tags", type: "string[]", note: "Free-form tags for filtering and grouping." },
                ].map(({ field, type, note }) => (
                  <div key={field} className="flex gap-3 items-start">
                    <code className="font-mono text-xs text-primary shrink-0 w-28">{field}</code>
                    <code className="font-mono text-xs text-muted shrink-0 w-14">{type}</code>
                    <p className="font-body text-xs text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Ratings and Responses */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Ratings &amp; Responses
          </h2>
          <div className="rounded-lg border border-border bg-panel p-4 space-y-5">
            <p className="font-body text-sm text-muted">
              Any submission can optionally include a rating and/or a structured set of
              multi-question responses. These fields are never required — they augment the core
              ticket model rather than replacing it.
            </p>

            <div>
              <p className="font-mono text-xs text-foreground mb-2">
                rating <span className="text-muted">(optional object — single primary rating)</span>
              </p>
              <div className="space-y-2 pl-4 border-l border-border">
                {[
                  { field: "value", type: "number", note: "The numeric rating. Required when sending a rating object." },
                  { field: "scale", type: "number", note: "Maximum possible value (e.g. 10 for NPS, 5 for stars). Used for cross-type normalization." },
                  { field: "type", type: "string", note: '"nps" | "stars" | "csat" | "thumbs" | "likert" or any custom string.' },
                  { field: "label", type: "string", note: 'Human-readable question label, e.g. "Likely to recommend".' },
                ].map(({ field, type, note }) => (
                  <div key={field} className="flex gap-3 items-start">
                    <code className="font-mono text-xs text-primary shrink-0 w-28">{field}</code>
                    <code className="font-mono text-xs text-muted shrink-0 w-14">{type}</code>
                    <p className="font-body text-xs text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono text-xs text-foreground mb-2">
                responses <span className="text-muted">(optional array — multi-question survey payload)</span>
              </p>
              <div className="space-y-2 pl-4 border-l border-border">
                {[
                  { field: "questionId", type: "string", note: 'Stable identifier for the question, e.g. "nps", "q1", "overall_sat".' },
                  { field: "type", type: "string", note: '"rating" | "nps" | "text" | "choice" | "multi_choice" | "boolean".' },
                  { field: "value", type: "any", note: "The answer: number for rating/nps, string for text/choice, boolean for boolean, string[] for multi_choice." },
                  { field: "scale", type: "number", note: "Max scale for numeric types." },
                  { field: "label", type: "string", note: "Human-readable label for the response value." },
                  { field: "options", type: "string[]", note: "For choice types: the full option set shown to the user." },
                ].map(({ field, type, note }) => (
                  <div key={field} className="flex gap-3 items-start">
                    <code className="font-mono text-xs text-primary shrink-0 w-28">{field}</code>
                    <code className="font-mono text-xs text-muted shrink-0 w-14">{type}</code>
                    <p className="font-body text-xs text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 space-y-1">
              <p className="font-mono text-xs text-primary">Behavior</p>
              <ul className="space-y-1 mt-1">
                {[
                  "If rating is sent, its value/scale/type are stored as indexed flat columns for fast SQL aggregations.",
                  "If only responses is sent, the first numeric-typed entry is automatically promoted to the flat columns.",
                  "Both can coexist — rating is a convenience alias for the primary response.",
                  "category, subject, and description remain required. Rating is always additive.",
                ].map((item) => (
                  <li key={item} className="font-body text-xs text-muted flex gap-2">
                    <span className="text-primary shrink-0">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <p className="font-mono text-xs text-muted mb-2">NPS — single rating</p>
                <pre className="rounded-lg border border-border bg-background/60 p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                  {npsExample}
                </pre>
              </div>
              <div>
                <p className="font-mono text-xs text-muted mb-2">5-star CSAT rating</p>
                <pre className="rounded-lg border border-border bg-background/60 p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                  {starsExample}
                </pre>
              </div>
              <div>
                <p className="font-mono text-xs text-muted mb-2">Multi-question survey (NPS + follow-up text + choice)</p>
                <pre className="rounded-lg border border-border bg-background/60 p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                  {multiQuestionExample}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Examples */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Code Examples
          </h2>
          <div className="space-y-4">
            <div>
              <p className="font-mono text-xs text-muted mb-2">curl</p>
              <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                {curlExample}
              </pre>
            </div>
            <div>
              <p className="font-mono text-xs text-muted mb-2">JavaScript / TypeScript</p>
              <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                {jsExample}
              </pre>
            </div>
            <div>
              <p className="font-mono text-xs text-muted mb-2">Python</p>
              <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                {pythonExample}
              </pre>
            </div>
          </div>
        </section>

        {/* Responses */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Responses
          </h2>
          <div className="space-y-4">
            <div>
              <p className="font-mono text-xs text-muted mb-2">Success — 201 Created</p>
              <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                {successResponse}
              </pre>
              <p className="font-body text-sm text-muted mt-2">
                Store <code className="font-mono text-xs">trackingId</code> or show{" "}
                <code className="font-mono text-xs">trackingUrl</code> to the submitter so they
                can follow their ticket status.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-muted mb-2">Error responses</p>
              <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                {errorResponses}
              </pre>
            </div>
          </div>
        </section>

        {/* Rate limits */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Rate Limits
          </h2>
          <div className="rounded-lg border border-border bg-panel p-4 space-y-2">
            {[
              { label: "Per API key", value: "60 submissions / minute" },
              { label: "Per IP address", value: "10 submissions / minute" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="font-body text-sm text-muted">{label}</span>
                <code className="font-mono text-xs text-foreground">{value}</code>
              </div>
            ))}
            <p className="font-body text-sm text-muted pt-2">
              Responses that exceed the limit return HTTP 429. The limits reset on a rolling
              60-second window.
            </p>
          </div>
        </section>

        {/* CORS */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            CORS
          </h2>
          <div className="rounded-lg border border-border bg-panel p-4 space-y-2">
            <p className="font-body text-sm text-muted">
              CORS is controlled via the{" "}
              <code className="font-mono text-xs">FEEDBACK_ALLOWED_ORIGINS</code> environment
              variable on the Tensient server. Contact your Tensient workspace owner to add your
              domain to the allowed origins list.
            </p>
            <p className="font-body text-sm text-muted">
              For security, we recommend calling this endpoint from your backend rather than
              directly from browser JavaScript — this also keeps your API key off the client.
            </p>
          </div>
        </section>

        {/* What gets captured server-side */}
        <section className="mb-10">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Server-Side Capture
          </h2>
          <div className="rounded-lg border border-border bg-panel p-4 space-y-2">
            <p className="font-body text-sm text-muted">
              Even without sending any <code className="font-mono text-xs">context</code> fields,
              Tensient automatically captures the following from every inbound request:
            </p>
            <ul className="space-y-1 mt-2">
              {[
                "IP address (from X-Forwarded-For)",
                "City, region, country (from Vercel geo headers)",
                "User-Agent (from request headers, as fallback)",
              ].map((item) => (
                <li key={item} className="font-body text-sm text-muted flex gap-2">
                  <span className="text-primary">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="flex gap-4">
          <a
            href="/docs"
            className="font-mono text-xs text-primary hover:text-primary/80 transition-colors"
          >
            ← BACK TO DOCS
          </a>
          <a
            href="/docs/auth"
            className="font-mono text-xs text-primary hover:text-primary/80 transition-colors"
          >
            AUTHENTICATION GUIDE →
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
