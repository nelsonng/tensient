# Tensient

**Enterprise Traction Control** -- prevents organizational drift by turning unstructured team updates into aligned, measurable action.

Your team generates noise. Tensient extracts signal. Every thought is measured against your goals. Alignment scored. Drift surfaced. Actions extracted.

**Live:** [tensient.com](https://tensient.com)

---

## How It Works

1. **Managers set strategy** -- paste goals into the Genesis flow. AI extracts pillars, vectorizes them as the "Canon" (strategic truth).
2. **Team members submit updates** -- text or voice. These are "Captures."
3. **AI processes every Capture** -- multi-coach composite prompt scores alignment against the Canon, extracts action items, and provides coaching feedback.
4. **Dashboard surfaces drift** -- alignment trends, team traction scores, streaks, weekly digests, and goal-linked actions.

```
Capture (voice/text)
    |
    v
AI Processing (Claude Opus 4.6 + Gemini embeddings)
    |
    +--> Artifact (drift score, sentiment, coaching)
    +--> Actions (goal-linked, priority-ranked)
    +--> Traction Score (rolling alignment average)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL (Neon) + pgvector |
| ORM | Drizzle |
| AI | Anthropic Claude Opus 4.6 |
| Embeddings | Gemini gemini-embedding-001 (1536 dims) |
| Auth | NextAuth v5 (JWT) |
| Transcription | Groq Whisper |
| Hosting | Vercel |

---

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/nelsonng/tensient.git
cd tensient
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in your keys (see .env.example for required vars)

# 3. Push schema to database
npx drizzle-kit push

# 4. (Optional) Seed demo data
SEED_PASSWORD=your-password npx tsx lib/db/seed-demo.ts

# 5. Run
npm run dev
```

---

## Project Structure

```
app/
  (auth)/           # Sign-in, sign-up pages
  dashboard/        # Workspace dashboard (server + client components)
  api/              # API routes (captures, strategy, actions, transcribe)
lib/
  db/               # Schema, migrations, seed scripts
  services/         # Core business logic (process-capture, genesis-setup, generate-digest)
  auth/             # Authorization helpers
  ai.ts             # AI clients (Anthropic LLM + Gemini embeddings)
  usage-guard.ts    # Cost controls (trial limits, daily caps, monthly budgets)
components/         # Reusable UI components
hooks/              # Custom React hooks (audio capture)
```

---

## Cost Controls

Every AI operation is gated by `checkUsageAllowed()` and logged by `logUsage()`:

- **Kill switch**: `PLATFORM_LOCKED` halts all AI operations
- **Trial limit**: 20 free operations per trial user
- **Daily cap**: 50 operations/user/day
- **Monthly budget**: $10/user/month
- **Platform cap**: 100 users max

---

## License

Proprietary. All rights reserved.
