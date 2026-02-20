# Tensient

**Any model. One place. Persistent context.**

Start a conversation on Claude, GPT, or Gemini. Your context persists across all of them -- every conversation, every session. Brain documents, Canon knowledge, and optional Coaches give the AI memory that compounds over time.

**Live:** [tensient.com](https://tensient.com)

---

## How It Works

1. **Start a conversation** -- text or voice. Pick any model.
2. **AI responds with context** -- it reads your Brain (personal notes), Canon (shared knowledge), and selected Coaches before every response. Structured output: summary, action items, coaching questions.
3. **Context compounds** -- every conversation, document, and upload becomes part of your persistent knowledge layer. The AI gets better the more you use it.

```
Message (voice/text/files)
    |
    v
AI Processing (Claude Opus 4.6 + Brain/Canon vector search + Coaches)
    |
    +--> Structured Response (summary, actions, coaching questions)
    +--> Auto-generated Title
    +--> Context persisted for future conversations
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

# 4. Run
npm run dev
```

---

## Project Structure

```
app/
  (auth)/           # Sign-in, sign-up, password reset, email verification
  dashboard/        # Workspace: conversations, brain, canon, coaches, settings
  admin/            # Super admin control center (metrics, funnels, retention)
  api/              # API routes (conversations, brain, canon, coaches, transcribe)
lib/
  db/               # Drizzle schema
  services/         # Core AI (process-conversation, extract-text)
  auth/             # Authorization helpers
  ai.ts             # AI clients (Anthropic LLM + Gemini embeddings)
  usage-guard.ts    # Cost controls (trial limits, daily caps, monthly budgets)
  platform-events.ts # Event tracking (acquisition, activation, errors)
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
