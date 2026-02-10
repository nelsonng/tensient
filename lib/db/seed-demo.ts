/**
 * seed-demo.ts -- Seeds the database with a realistic 6-week demo dataset
 * for Tensient Health, a fictional B2B healthcare operations platform.
 *
 * Usage:
 *   DATABASE_URL=... GEMINI_API_KEY=... ANTHROPIC_API_KEY=... npx tsx lib/db/seed-demo.ts
 *
 * Creates: 1 org, 8 users, 1 workspace, 8 memberships, 1 canon (goals), 34 captures + artifacts
 * Cost: ~35 Anthropic API calls + Gemini embeddings
 * Runtime: ~2-3 minutes
 *
 * This script is self-contained and does not import from service modules
 * (which use @/ path aliases that tsx cannot resolve).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import { hash } from "bcryptjs";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import {
  organizations,
  users,
  workspaces,
  memberships,
  protocols,
  captures,
  artifacts,
  canons,
} from "./schema";

// ── Database & AI clients ───────────────────────────────────────────────

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-opus-4-6";

// ── Helpers ─────────────────────────────────────────────────────────────

function nanoid(length: number = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await gemini.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 1536 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

async function generateStructuredJSON<T>(opts: {
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<T> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: opts.schema,
      },
    },
  });
  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "{}";
  return JSON.parse(text) as T;
}

function cosineSimilarity(a: number[], b: number[]): number {
  // Note: duplicated here intentionally -- seed script runs standalone outside the app
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Personas ────────────────────────────────────────────────────────────

interface Persona {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: "owner" | "member";
}

const SEED_PASSWORD = process.env.SEED_PASSWORD || "change-me-before-use";

const PERSONAS: Persona[] = [
  { email: "nelson@tensient.com", firstName: "Nelson", lastName: "Ng", password: SEED_PASSWORD, role: "owner" },
  { email: "rachel@tensient.com", firstName: "Rachel", lastName: "Chen", password: SEED_PASSWORD, role: "member" },
  { email: "alex@tensient.com", firstName: "Alex", lastName: "Kim", password: SEED_PASSWORD, role: "member" },
  { email: "jordan@tensient.com", firstName: "Jordan", lastName: "Rivera", password: SEED_PASSWORD, role: "member" },
  { email: "marcus@tensient.com", firstName: "Marcus", lastName: "Thompson", password: SEED_PASSWORD, role: "member" },
  { email: "priya@tensient.com", firstName: "Priya", lastName: "Patel", password: SEED_PASSWORD, role: "member" },
  { email: "sam@tensient.com", firstName: "Sam", lastName: "Okafor", password: SEED_PASSWORD, role: "member" },
  { email: "kai@tensient.com", firstName: "Kai", lastName: "Nguyen", password: SEED_PASSWORD, role: "member" },
];

// ── Goals (Canon) ───────────────────────────────────────────────────────

const GOALS_RAW_INPUT = `In 2026, Tensient Health becomes the platform health systems trust to run their most critical operational workflows. We take ownership of the problems at the intersection of staffing and compliance, and build the operational backbone that makes hospitals safer, faster, and more cost-effective.

Our priorities:

1. Dominate the top 20 health systems by region through deep multi-threading and executive relationships. Named account strategy with clear expansion paths in every target system. Create naturally compounding channels through content, benchmarking data, and community of practice for hospital ops leaders.

2. Deliver hard ROI data -- FTE hours recouped, compliance gaps closed, cost savings realized -- that CNOs and CFOs use to justify expansion to every department. Implement to expand within one year. Track success by client segment. Make the data so compelling that our champions can sell internally without us in the room.

3. Ship next-generation staffing intelligence that shifts hospitals from reactive scheduling to proactive resource management. Intent-based scheduling that resolves by policy, not by hardcoded rules. Credential verification as a platform capability, not a manual process. Speed and quality of shift fulfillment as the key differentiator.

4. Launch compliance automation as our second major product line, starting with a finance beachhead -- credentialing, audit readiness, and regulatory tracking -- then expanding into clinical compliance. Strategic packaging ahead of product delivery to validate demand.

5. Build a leadership culture that scales with the complexity of our market. Establish clear lanes and strong lines of sight for operational alignment. Show up intentionally for high quality remote work. Grow leaders who act with agency and innovate from first principles. AI operationally and personally.

Values: Lead with conviction, even when it's uncomfortable. Listen actively for what customers aren't telling us. Own outcomes boldly -- speak up and challenge even when it's uncomfortable. Solve for opportunities over problem protection. Stay purposefully strange.`;

// ── Captures ────────────────────────────────────────────────────────────

interface CaptureEntry {
  personEmail: string;
  date: string;
  content: string;
}

const CAPTURES: CaptureEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // RACHEL CHEN (CEO) -- 4 captures, semi-regular
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "rachel@tensient.com",
    date: "2026-01-06T10:30:00Z",
    content: `Happy new year everyone. OK so coming out of the break I've been thinking a lot about Q1 and where we need to be by end of March. The board meeting is in early March so we need to have a really tight story by then. A few things on my mind.

First, the Adventist Health conversation is moving faster than I expected. Their VP of Operations basically told me over the holidays that they want to be our flagship reference customer for the credential verification module. This is huge because we've been trying to get a marquee name for months and they're volunteering. I think this validates the whole Data Conquest thesis we've been talking about -- when we deliver real value, customers actually want to give us MORE data and MORE access, not less. I want Nelson's team to prioritize the hell out of making this pilot successful.

Second, I'm worried about Memorial Health. Their CTO just left -- retired actually, it was planned but nobody told us -- and the new person is apparently "re-evaluating all vendor relationships." We can't lose this account, it's one of our largest and the logo matters enormously for the Series B narrative. Sam needs to be all over this but I also think we need an executive-level outreach from me directly to their CNO. Going to ask Sam to set that up.

Third, the finance beachhead strategy for compliance automation. Kelsey's been working on the GTM plan and I think we're ready to start testing messages. The hypothesis is that credentialing and audit readiness are the entry points because every hospital CFO cares about Joint Commission accreditation risk. If we can show even 3-4 early signals of demand this quarter, that changes the Series B story from "staffing platform expanding" to "healthcare ops platform with multiple products."

Pipeline overall is OK but not great. We need to close 2 more mid-market deals this quarter to hit the board deck numbers. Monthly burn is tracking to plan which is good. Headcount is at 54, we're hiring for 3 more roles on Nelson's team.

One more thing -- I've been thinking about our values and whether they're landing with the team. I wrote this whole V2MOM thing but I'm not sure people are actually using it to make decisions. Like, "stay purposefully strange" -- does anyone actually know what that means in their day to day? I think we need to make values more operational and less aspirational. Something for the leadership team to discuss.`,
  },
  {
    personEmail: "rachel@tensient.com",
    date: "2026-01-17T14:00:00Z",
    content: `Board prep is consuming most of my brain right now. I've been in the data room all week pulling together the Q4 actuals and Q1 forecast and there are some numbers I'm really proud of and some that concern me.

Good news first: NRR is at 118% which is best we've ever done. The expansion playbook is working -- land with staffing, prove value, expand into more departments. Adventist Health pilot is officially kicked off, Nelson's team has the integration live in staging and the first cohort of nurses starts using it Monday. If this works the way we think it will, we have our first real "credential verification saves 60% of manual time" data point which is the whole pitch for the Series B.

Now the concerns. New logo acquisition is behind plan. We targeted 8 new health systems this quarter and we're tracking to maybe 5-6. Part of it is just cycle time -- enterprise healthcare sales are slow, everyone knows that -- but part of it is that our top-of-funnel messaging still isn't crisp enough. I had a call with a CNO at a 400-bed hospital last week and when I described what we do she said "so you're like a staffing agency?" and I wanted to scream. We're a PLATFORM. Priya needs to fix this. The messaging has to be so clear that even someone who's never heard of us gets it in 30 seconds.

Also had a really interesting conversation with the Riverside team -- they're a 12-hospital system in the southeast and they actually volunteered to send us their position control data for our intent-based scheduling engine. They didn't even ask for anything, they just said "we believe in what you're building and want to help you build it faster." This is the kind of organic pull that gets me excited. It validates that we're solving a real, deep problem.

Risk item: the WCAG audit vendor delay that Nelson flagged last month is apparently resolved now, 30-day turnaround confirmed. Good. We absolutely need SOC2 and accessibility certs by mid-year for the enterprise pipeline.`,
  },
  {
    personEmail: "rachel@tensient.com",
    date: "2026-01-30T09:15:00Z",
    content: `Mid-quarter gut check. Feeling cautiously optimistic but there are some things keeping me up at night.

The Adventist pilot is going really well by all accounts. Nelson showed me the early data and nurses are spending 60% less time on manual credential uploads. That's a real number, not a projection. If we can replicate that across even half their system, the ROI story writes itself. I want Priya to start working on the case study NOW, not after the pilot officially ends. We need this for the board deck.

Memorial Health update: I finally got a meeting with their CNO, Dr. Watkins. She's actually a supporter but she's politically cautious -- the new CTO wants to do a formal vendor review and she doesn't want to be seen as playing favorites. Sam set up a QBR for next Wednesday where we're going to present ROI data specific to their system. If we nail this, I think we keep them. If we fumble it, the new CTO will use it as an excuse to bring in a competitor for a bake-off.

On the compliance automation front, I've been doing customer discovery calls myself. Talked to 6 CFOs and 4 compliance officers in the last two weeks. The pattern is clear: everyone is terrified of Joint Commission accreditation gaps but nobody has a system to proactively manage compliance. They're all doing it in spreadsheets and email. The demand signal is strong. I told Kelsey to start building a waitlist landing page.

Team-wise, I'm a little worried that we're stretched thin. Nelson's team is executing on three major workstreams simultaneously (credential verification, scheduling engine, SOC2) and I can see the strain. Sam on the CS side is definitely underwater -- he's got 22 accounts and at least 5 of them need serious attention. I need to think about whether we hire more CS capacity or whether there's a product-led approach to reducing support burden. Probably both.

Burn rate still on track. Cash runway is 18 months at current burn. Series B conversations start in earnest in Q2.`,
  },
  {
    personEmail: "rachel@tensient.com",
    date: "2026-02-06T11:00:00Z",
    content: `Just got out of the board meeting. Went really well actually -- better than I expected. The board loved the Adventist pilot data and the Riverside partnership story. They're bullish on the compliance automation opportunity and agreed that we should start investing in it this quarter, even if it means the staffing product roadmap slows down slightly.

Key takeaways from the board: they want us to be more aggressive on the expansion motion. Their exact words were "you're being too polite with your existing customers." They think we should be pushing harder for multi-department deals earlier in the relationship. I agree in principle but the timing has to be right -- you can't push expansion before you've proven value in the first department. Going to workshop this with the GTM team.

The board also pushed back on our new logo target for Q1. They think 5-6 is fine if NRR stays above 115%. Their view is that at our stage, expansion revenue is more capital-efficient than new logo acquisition, and I actually agree with that. Feels like a slight strategic pivot from what we planned in the V2MOM but it's the right call.

On the product side, I told the board about the intent-based scheduling engine and they were genuinely impressed by the vision. One board member said "that's the kind of technical moat that makes this a platform company, not a feature." Nelson, if you're reading this, the board gets it. Keep pushing.

Compliance automation: I'm announcing internally next week that this is officially our second product line. We're going to staff a small tiger team -- probably Jordan as PM, one engineer, and Priya on go-to-market. More details coming.

One thing I need to figure out: how to communicate all of this to the broader company in a way that doesn't feel like we're changing direction every month. The V2MOM is still valid but the emphasis is shifting. Need to do a good job of framing this as "sharpening" not "pivoting."`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // NELSON (VP P&E) -- 6 captures, weekly Fridays
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "nelson@tensient.com",
    date: "2026-01-03T17:00:00Z",
    content: `First Friday of the year, getting the team realigned after the break. Spent most of this week doing Q1 planning and I feel good about where we landed. Three major workstreams for the quarter:

1. Credential Verification -- this is the big one. We need to get the Adventist Health pilot live by mid-January and show real ROI data by end of February. The core tech is there but the integration with their state nursing board API is fiddly. Their API documentation is, charitably, incomplete. Marcus is point on the backend integration and Kai is building the frontend dashboard. Alex is designing the nurse-facing flows.

2. Intent-Based Scheduling -- this is the architectural bet. We're shifting from hard-coded routing rules ("send this shift to Bob") to policy-based resolution ("send this shift to the most qualified available nurse in this unit"). It's a fundamental rethink of how our scheduling engine works. The alpha should be testable internally by end of January.

3. SOC2 Type II -- we engaged the auditor before the break and they're starting the gap assessment in two weeks. I'm expecting 10-15 remediation items, mostly around encryption and access logging. This is table stakes for the enterprise pipeline.

Hiring: we closed the senior data engineer (Maya Chen, starts January 13th -- no relation to Rachel lol). Still need a DevOps lead badly. Our infrastructure is being held together by Marcus and duct tape. I've got 3 candidates in the pipeline but honestly none of them feel like a strong yes. Might need to up the comp band or look for a more senior infrastructure architect type.

Team morale feels decent coming out of the break but I want to keep an eye on it. Q1 is going to be intense with three simultaneous workstreams. I'm trying to be realistic about capacity but Rachel is pushing hard on the Adventist timeline which I understand but it creates downstream pressure on everything else.

One thing I want to get better at this quarter: making our work visible to the rest of the company. The product and engineering team does incredible work but we suck at communicating it. I want every major milestone to get a proper internal announcement, not just a Slack message that scrolls off the screen.`,
  },
  {
    personEmail: "nelson@tensient.com",
    date: "2026-01-10T16:30:00Z",
    content: `Week 2 update. Sprint velocity is solid, we shipped 42 points which is above our trailing average of 38. Main progress:

Credential Verification: Marcus has the state nursing board API integration working in staging. The big discovery this week is that their API has undocumented rate limits -- 100 requests per minute, which sounds fine until you realize that onboarding a new hospital with 2000+ nurses means you need to verify all their credentials at once. Marcus is building a queue system with exponential backoff. Smart solution, just annoying that we have to do it. The good news is the actual credential matching logic is solid -- we're getting 98% auto-match rates in our test data.

Scheduling Engine: I spent most of Wednesday and Thursday working on the policy DSL for intent-based routing. The core insight is that we need to separate "what should happen" (policy) from "who specifically does it" (resolution). This means a hospital can say "shifts above 12 hours require a charge nurse" as a policy, and the system resolves who that charge nurse is based on credentials, availability, and unit assignment. It's elegant in theory. Implementation is gnarly. Got 3 out of 4 test scenarios passing. The fourth -- cross-department float pool assignment -- is a beast because it introduces a priority hierarchy that the DSL doesn't currently express.

SOC2: auditor engagement is confirmed, gap assessment starts January 20th. I've been pre-auditing our own systems and I already know the encrypted-at-rest situation is going to be a finding. We're on AES-128 for the credential store and SOC2 wants AES-256. Marcus knows this is coming.

New hire Maya starts Monday. I'm pairing her with Marcus for the first week on the FHIR adapter work so she ramps up on both our codebase and the healthcare data standards at the same time. 

Still no strong DevOps candidates. Thinking about reaching out to my network directly. We literally cannot afford to not have this role filled by end of Q1.`,
  },
  {
    personEmail: "nelson@tensient.com",
    date: "2026-01-17T17:00:00Z",
    content: `Big week. Credential verification alpha is LIVE in the Adventist Health staging environment. Their IT team ran smoke tests yesterday and everything passed. First cohort of nurses gets access Monday. I'm cautiously very excited about this.

The integration architecture ended up being cleaner than I feared. We're pulling credential data from three sources: the state nursing board API (Marcus's integration), their internal HR system via SFTP (legacy but it works), and a manual upload flow for edge cases (temporary or travel nurses whose credentials aren't in either system yet). The matching engine cross-references all three and flags discrepancies. It's not glamorous but it solves a genuine nightmare scenario -- imagine a nurse whose license expired showing up for a shift because nobody checked. That's a Joint Commission violation and a lawsuit waiting to happen.

SOC2 gap assessment kicked off. Auditor is on-site... well, "on-site" meaning on a Zoom call for 4 hours going through our architecture docs. Initial vibes are good -- they said our overall security posture is better than most companies our size. The formal findings come in 2 weeks.

Scheduling engine: I took a different approach to the float pool problem. Instead of trying to express the priority hierarchy in the DSL, I'm treating it as a constraint satisfaction problem and using a scoring function to rank candidates. Each candidate gets a score based on credential match, unit proximity, overtime status, and preference. The policy just says "resolve from float pool" and the scoring function handles the rest. Got all 4 test scenarios passing now. Need to run it against real shift data from one of our existing customers to validate.

Kai flagged a concern about the credential dashboard bundle size. It went from 340kb to 510kb after we added the compliance module. I told him to profile it but not to panic yet -- we can always lazy-load the compliance components. Alex delivered the high-fidelity mockups for the credential dashboard and they look great. Jordan is coordinating the pilot logistics.

Rachel asked me to prioritize making the Adventist pilot successful above all else this quarter. I agree with the priority but I'm keeping one eye on scheduling and SOC2 because if either of those slip, the whole Q2 plan falls apart.`,
  },
  {
    personEmail: "nelson@tensient.com",
    date: "2026-01-24T17:00:00Z",
    content: `Credential verification pilot update: first week of real usage at Adventist Health and the results are genuinely impressive. 847 nurses processed through the system. Auto-match rate: 94% (target was 90%). Average time to verify a credential: 12 seconds vs their previous manual process which took 8-15 minutes per nurse. That's a 60x improvement. Even I didn't expect it to be that dramatic.

There are edge cases though. 6% of nurses couldn't be auto-matched because of name discrepancies between the state board records and the hospital's HR system (maiden names, hyphenated names, typos). We need a fuzzy matching layer. Marcus is looking at Levenshtein distance with some healthcare-specific heuristics (e.g., common name abbreviations like "Wm" for William). Should be a 2-3 day effort.

Scheduling engine alpha is now running against anonymized shift data from one of our existing customers. Early results are promising -- the intent-based routing correctly assigns 87% of shifts vs the rule-based system's 91%. That 4% gap is mostly in edge cases where implicit institutional knowledge is encoded in the rules (e.g., "everyone knows that Dr. Martinez's unit doesn't take float nurses on Mondays"). We need to figure out whether to encode that knowledge as policy or accept the gap.

SOC2: formal gap assessment report came back. 12 items total -- better than the 15 I expected. 8 are code changes (encryption upgrades, access logging, session management). 4 are process documentation (incident response plan, change management policy, vendor review procedures). I'm assigning the process docs to Jordan since she's the most organized person on the team and this is basically PM work. Code items go to Marcus with Maya supporting.

DevOps situation: I found a strong candidate through my network. She's a senior SRE from a health tech company in SF, knows AWS and Kubernetes, and has SOC2 experience. First interview next week. Fingers crossed.

Team energy is high. The Adventist pilot win has people feeling like we're building something that actually matters. That's the fuel you can't manufacture.`,
  },
  {
    personEmail: "nelson@tensient.com",
    date: "2026-01-31T17:00:00Z",
    content: `End of January. Let me do a proper T5T for the month.

1. Credential Verification Pilot: Adventist Health results are solid enough to start the case study. 94% auto-match, 60x speed improvement, zero missed expirations. The fuzzy matching layer Marcus built is working well -- we're up to 97% auto-match now. Two remaining issues: (a) the state board API rate limits are causing timeouts during bulk operations for larger hospitals, Marcus is building the queue system, and (b) we need to handle "compact" nursing licenses (nurses licensed in one state practicing in another through the Nurse Licensure Compact). This is a data model thing, not a hard problem, but it's not in our current schema.

2. Scheduling Engine: Alpha results show 87% correct assignment vs 91% for rule-based. I'm actually OK with this because the 4% gap is made up of cases where the rule-based system has implicit human knowledge baked in. The intent-based system will get there as hospitals encode their actual policies. The bigger win is maintainability -- when a nurse leaves or a unit restructures, the intent-based system adapts automatically. Rule-based systems need manual reconfiguration which takes weeks.

3. SOC2: 12 gap items identified. 3 code changes already in PR (session management, audit logging, API key rotation). Encryption migration is the big one -- Marcus estimates 2 weeks for the full AES-256 migration with key rotation. Process docs assigned to Jordan, she's treating it like a product spec which is actually perfect.

4. Team: Maya (senior data engineer) is ramping well, already contributing to the FHIR adapter. DevOps candidate interview went great -- making an offer next week. Morale is good but I'm sensing some strain from Marcus specifically. He's carrying the backend load for credential verification, SOC2 encryption, AND the FHIR adapter simultaneously. I need to redistribute some of this once Maya is fully ramped.

5. Risk: Sam flagged that CS is struggling with support volume. Three hospitals have open tickets about shift notification delays that have been unresolved for 2 weeks. I told him to escalate directly to me. The notification issue is a known thing -- it's a race condition in the websocket layer that Marcus already has a fix for but it hasn't been prioritized because of all the other work. I'm going to bump it up. We can't let customer experience suffer while we're building new features.

Rachel's board meeting is next week. I've prepared a product section for the deck with the Adventist data. Feeling good about it.`,
  },
  {
    personEmail: "nelson@tensient.com",
    date: "2026-02-07T17:00:00Z",
    content: `Mid-quarter retrospective. Six weeks into Q1 and here's where we stand.

The big picture is positive. Credential verification is working in production at Adventist Health with great numbers. Board loved it. Rachel just announced compliance automation as our second product line, which is exciting and terrifying in equal measure because it means we're about to staff a new workstream on top of everything else.

On the scheduling engine: I've decided to keep it in alpha through Q1 and not push for GA until Q2. The 87% accuracy rate needs to be at least 95% before we can put it in front of customers, and the remaining 8% is the hardest 8%. Cross-department float pools, union rules, on-call cascade logic -- this is the gnarly stuff that hospitals care about deeply. I'd rather ship something bulletproof in Q2 than something fragile in Q1. Rachel agreed.

SOC2 progress: 8 of 12 items complete. The AES-256 migration is in staging and Marcus is running compatibility tests with all our integrations. Expecting to ship it next week. Process docs are 3 of 4 done -- Jordan is finishing the incident response plan. Auditor final review scheduled for end of February.

The thing that worries me most right now is the Epic FHIR adapter brittleness. We've been finding edge cases all month -- unexpected HL7v2 message formats, FHIR servers that don't fully implement the spec, different Epic installations with different quirks. It's death by a thousand paper cuts. Marcus is handling it heroically but this isn't sustainable. I think we need to invest in a proper integration testing framework that simulates different hospital EHR configurations. That's a Q2 project.

DevOps: made the offer, she accepted! Starts February 17th. This is going to be transformational for our infrastructure reliability.

The notification delay issue that Sam escalated is now fixed -- Marcus shipped the websocket race condition fix on Tuesday. Three hospitals confirmed the issue is resolved. I feel bad that it took 3 weeks to get to this. We need a better process for triaging customer-impacting bugs vs feature work.

Team vibe check: everyone's tired but motivated. The Adventist success gave us a tangible win to rally around. The compliance automation announcement created some anxiety though -- people are wondering if it means less headcount for existing projects. I need to address this directly in next week's all-hands.`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ALEX KIM (Senior Designer) -- 3 captures, every 10-14 days
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "alex@tensient.com",
    date: "2026-01-08T11:00:00Z",
    content: `OK so this week I started on the credential dashboard design. Been looking at a bunch of reference apps -- Rippling's HR dashboard is really clean, and I like how Gusto handles compliance status with those little indicator pills. I'm experimenting with a card-based layout for each nurse where you can see their name, unit, credential status, and expiration date all at a glance. The tricky part is figuring out what to do when there's a discrepancy -- like if the state board says their license expires March 15 but the hospital's HR system says April 15. I'm thinking a red highlight with a tooltip that shows both dates side by side but I'm not totally sure that's discoverable enough.

Also started sketching the shift assignment interface. This one is interesting because the current flow is basically a giant spreadsheet and the nurses hate it. I want to make it feel more like a calendar with drag-and-drop but I know from experience that calendar UIs are deceptively complex. Need to think about how it works on tablet because a lot of charge nurses are using iPads at the nurses' station.

Jordan asked me to also look at the onboarding flow for new hospitals but I haven't started that yet. I figure the credential dashboard is higher priority since the Adventist pilot is using it. Going to need some real data to design against though -- the fake data in Figma only gets you so far.

The other thing I've been noodling on is our overall visual language for compliance-related UI. Red/yellow/green is obvious for status indicators but I want to make sure we're not relying solely on color because of accessibility. Thinking about combining color with icons and text labels. Will share explorations in the design review on Thursday.`,
  },
  {
    personEmail: "alex@tensient.com",
    date: "2026-01-22T14:00:00Z",
    content: `Design update for the week. Here's where things are at across my board:

Credential dashboard: high-fidelity mockups are done and Jordan reviewed them. Her main feedback was that credential expiration dates need to be way more prominent -- she wants a countdown timer that turns red when a credential is within 30 days of expiring. That's a good call, I'm updating the design. Also need to figure out the "partially verified" state better. When we pull data from the state board and it doesn't match the hospital's HR data, what does the nurse see? Right now I have a yellow banner that says "verification in progress" but that's kind of a lie if the actual situation is "your records don't match and a human needs to sort it out." Need to talk to Jordan about the right copy here.

Onboarding flow: I did some wireframes for the hospital onboarding experience. The information architecture is complicated because different hospitals have different EHR systems and the setup process is different for each one. I'm thinking of a wizard-style flow where you pick your EHR first and then the steps adapt. But I haven't validated this with anyone yet. It's sitting in my Figma drafts.

Shift assignment UX: haven't touched this in a week. It's still in the sketch phase. The drag-and-drop calendar thing is going to be a big effort and I know Kai is already stretched on the credential dashboard frontend.

Other stuff: there's a visual bug in the notification dropdown where long notification text overflows the container on mobile. It's been bugging me for weeks. Also started thinking about our compliance status indicator system -- we need a consistent pattern across the entire app, not just the credential dashboard. Wrote some notes in the design system doc but no components built yet.

I know I should be more focused. There are like 6 things on my plate and I keep bouncing between them instead of finishing one thing completely. Going to try to just lock in on the credential dashboard updates this week and not context switch.`,
  },
  {
    personEmail: "alex@tensient.com",
    date: "2026-02-05T10:30:00Z",
    content: `Did an accessibility audit of the credential dashboard this week. We're not in great shape. Found 4 places where the color contrast doesn't meet WCAG AA standards -- mostly in the status indicators ironically, which is exactly what I was worried about. The green-on-white for "verified" status is only 3.2:1 contrast ratio, needs to be 4.5:1. Fixed 2 of them by darkening the colors. The other 2 need changes to the design system tokens which I want to coordinate with the broader brand colors so we don't end up with a frankenstein situation.

The bigger accessibility issue is the shift calendar. The drag-and-drop interactions have no keyboard equivalent and no ARIA roles. This is going to be a significant effort to fix -- Kai is going to need to implement keyboard navigation for the entire grid and add proper screen reader announcements for shift moves. I wrote up a spec for how it should work but I know the team is slammed.

Also got feedback from one of the Adventist Health nurses that the credential dashboard text is too small on their older monitors. They're running 1366x768 which, yeah, that's rough. Our minimum responsive breakpoint is 1280px wide so technically it works but the text is cramped. Probably need to bump the base font size up for the data-dense screens.

I keep meaning to finish the onboarding flow wireframes but I haven't had a dedicated block of time for it. It's one of those projects that needs 3-4 hours of uninterrupted thinking and I keep getting pulled into small tasks instead. Maybe I should block off a whole day next week.`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // JORDAN RIVERA (PM) -- 5 captures, weekly-ish
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "jordan@tensient.com",
    date: "2026-01-06T09:00:00Z",
    content: `Q1 planning week. Spent most of the week getting the roadmap locked down with Nelson and making sure all the workstreams have clear owners and timelines. Here's where we landed:

Credential Verification: I own this end-to-end from a product perspective. The pilot with Adventist Health starts mid-January. I need to coordinate with their IT team on the integration timeline, make sure Alex's designs are finalized for the nurse-facing UI, and work with Sam to set up the feedback loop. The success metrics are: auto-match rate above 90%, average verification time under 30 seconds, and zero missed credential expirations.

Scheduling Engine: Nelson is leading this directly since it's deeply technical. My role is mainly to gather requirements from customers about what policies they need to express. I've got 3 customer calls scheduled this week to understand their current scheduling rules and what an "intent-based" approach would look like in practice.

SOC2: Nelson wants me to own the process documentation workstream (4 items). I've never written an incident response plan before so I need to look at some templates and talk to Marcus about our current processes. Honestly this feels a little outside my lane but I understand why Nelson picked me -- it's basically product spec writing with a compliance twist.

Compliance Automation: this is the new thing Rachel is excited about. I don't have clear scope on it yet but I volunteered to do some customer discovery calls alongside Rachel to understand the opportunity. If it becomes a real workstream, I think I'd want to PM it.

Other stuff: need to sync with Priya on the Adventist pilot messaging. She wants to do a case study but I think it's too early -- we don't have results yet. Also need to update the product roadmap doc for the board meeting. And there are like 12 Jira tickets that need grooming. Never enough hours.`,
  },
  {
    personEmail: "jordan@tensient.com",
    date: "2026-01-14T10:00:00Z",
    content: `Credential verification pilot coordination is eating my week but in a good way I think.

Talked to the Adventist Health IT team on Monday. They're surprisingly well-organized for a hospital system. They've already set up a staging environment, gave us test accounts, and assigned a project manager on their side (Denise). The integration timeline is aggressive -- Marcus says the state board API integration is done in staging, and the HR system SFTP feed is configured. We're targeting go-live for the first nurse cohort on January 20th, which is next Monday. I need to write the user communication plan and make sure the training materials are ready.

Customer discovery for scheduling: I had 2 of the 3 calls. The patterns are interesting. Every hospital has a slightly different set of rules and they're all encoded in someone's head (usually the charge nurse who's been there for 20 years). Getting those rules written down is actually the hard part, not the technology. One CNO told me "we have a rules document but it hasn't been updated since 2019 and nobody follows it anymore." Classic.

For the compliance automation discovery: Rachel and I talked to 2 CFOs this week. Both immediately understood the value prop for credentialing automation. One of them literally said "I have a full-time person whose entire job is checking credentials and updating spreadsheets." The other one was more interested in audit readiness -- she wanted a system that continuously monitors compliance status and alerts before something expires, not after. Both of these are totally buildable.

SOC2 process docs: I looked at some incident response plan templates and, yeah, this is basically a flowchart with roles and SLAs. I drafted the outline and showed it to Marcus. He gave me a bunch of feedback about what our actual process is today (which is mostly "Marcus gets paged and fixes it"). We need to formalize this regardless of SOC2.

Need to sync with Alex on the credential dashboard -- his designs look great but I want to make sure the expiration countdown is prominent enough. Also need to review Kai's frontend implementation.`,
  },
  {
    personEmail: "jordan@tensient.com",
    date: "2026-01-23T15:00:00Z",
    content: `Sprint review day. Here's the status across all my workstreams:

Credential Verification: pilot is live and the first week data is coming in. Nelson's been tracking the numbers closely. I'm focused on the qualitative side -- I set up a feedback Slack channel with 5 Adventist nurses and they're actually using it. Main feedback so far: the dashboard is "clean and easy" (yay Alex), the auto-verification is "like magic," but 3 nurses complained that when their credentials DON'T auto-match, the resolution process is confusing. They don't know what to do next. I think we need a clearer "action required" workflow for discrepancies.

Compliance Dashboard: internal release happened today! Priya wrote the knowledge base article and I reviewed it. It's... enthusiastic. I toned down some of the adjectives before publishing. The dashboard shows real-time credential status across all nurses in a hospital system with expiration tracking, discrepancy alerts, and compliance score by unit. The score calculation is based on percentage of credentials that are current, verified, and undisputed.

SOC2 Process Docs: incident response plan is drafted, change management policy is drafted. Need to write the vendor review procedures and the data handling policy. Marcus reviewed the incident response plan and said it's "surprisingly accurate for someone who's never been paged at 3am." I'll take that as a compliment.

Memorial Health: Sam asked me to help prepare the QBR deck. The new CTO wants to see hard ROI data. I pulled together our usage analytics for their system -- 3,200 shifts processed, 89% auto-assigned, estimated 420 hours of manual scheduling saved. The numbers are good but I want to sanity-check them with Marcus before we present.

Upcoming: Rachel wants me to start scoping the compliance automation product. I need to turn the customer discovery findings into a product brief. Also, the FHIR adapter timeline is starting to worry me because it impacts Q2 roadmap planning. Need to get a solid estimate from Marcus.`,
  },
  {
    personEmail: "jordan@tensient.com",
    date: "2026-01-31T11:00:00Z",
    content: `Month-end update. A few things converging this week that are making me feel stretched.

The big one: Nelson assigned me the SOC2 process documentation and the compliance automation product brief at the same time. Both are important, both need my attention, and they're completely different types of work. The SOC2 stuff is detailed, procedural, compliance-y. The product brief is creative, strategic, exploratory. Context-switching between them is killing my productivity. I wish I could just focus on one for a full week but there are dependencies on both.

Credential verification pilot: we're 2 weeks in and the data is looking really strong. I compiled a summary for the board deck: 847 nurses processed, 97% auto-match rate (after Marcus's fuzzy matching update), average verification time of 12 seconds. The "action required" workflow for discrepancies is still not great -- I wrote a spec for a better flow but Alex hasn't started the design yet. He says he'll get to it next week.

FHIR adapter timeline: I finally cornered Marcus and got a straight answer. He says the adapter is "functional but brittle" and needs at least 2 more weeks of hardening before it's production-ready. This means the credential verification system's real-time sync capability (which depends on FHIR) won't be fully reliable until mid-February. I need to adjust the roadmap and communicate this to Rachel.

Compliance automation brief: I've got the customer discovery notes from 6 CFO calls and 4 compliance officer calls. The pattern is clear: credentialing and audit readiness are the entry points. I'm structuring the brief around three capabilities: (1) continuous credential monitoring, (2) expiration alerting and auto-renewal workflows, (3) audit readiness dashboards with exportable reports. Target audience: hospital compliance officers and CFOs.

SOC2: 3 of 4 process docs done. The vendor review procedures are the last one. I'll have it done by end of next week.

Memorial Health QBR went well. The new CTO actually engaged and asked good questions. Sam is cautiously optimistic. We'll know more next week.`,
  },
  {
    personEmail: "jordan@tensient.com",
    date: "2026-02-07T14:00:00Z",
    content: `This week has been about cross-team coordination which is just a nice way of saying I spent most of my time in meetings making sure everyone is talking to each other.

Compliance automation: Rachel officially announced it as our second product line. I'm the PM. Exciting and scary. The product brief is done and Rachel approved it. Now I need to figure out eng staffing with Nelson, and coordinate the go-to-market timeline with Priya. She's already got ideas for the launch messaging but I want to make sure we're not promising things the product can't deliver yet. We've had that problem before.

Credential verification: the pilot is in steady state now. The numbers are holding -- 97% auto-match, 12-second average verification. Adventist is happy. I'm working on the "what's next" plan -- expanding to more departments within Adventist, and using their data to build the case for the next 3 pilot hospitals. Rachel wants to move fast on this.

SOC2: all 4 process docs submitted to the auditor. They came back with minor feedback on the incident response plan -- they want more detail on the communication protocol for data breaches specifically. Fair enough, HIPAA makes that a big deal in healthcare. I'll update it early next week.

The thing that's nagging at me is dependencies. The compliance automation product depends on the FHIR adapter being reliable (so we can pull credential data in real-time), which depends on Marcus finishing the hardening work, which is competing with his SOC2 encryption migration. And the scheduling engine depends on the policy DSL that Nelson is building, which he's deprioritizing in favor of the credential pilot. Nothing is blocked exactly, but everything is interconnected and there's not much slack in the system. If anything slips, it cascades.

Also: I need to push Alex to finish the onboarding flow wireframes. We keep saying "we'll get to it" but the hospital onboarding experience is a real bottleneck for scaling. Every new hospital takes 2-3 weeks of custom setup right now. If we don't fix that, the expansion plan doesn't work.`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MARCUS THOMPSON (Senior Backend Engineer) -- 4 captures, irregular
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "marcus@tensient.com",
    date: "2026-01-10T18:00:00Z",
    content: `Alright here's what I shipped this week. Spent most of it on the FHIR R4 adapter refactor. The previous implementation was doing individual GET requests to the Practitioner endpoint for each nurse credential check, which worked fine in testing with 50 records but completely fell over at scale. A health system with 2000+ practitioners was generating 2000+ sequential HTTP requests, each taking 200-400ms, and the Epic FHIR server was responding with 408 Request Timeout after about 1200 requests because they have an undocumented rate limit of 100 requests per minute.

The fix: moved to a bulk $export operation using the FHIR Bulk Data specification. We send a single POST to /$export with a _type parameter for Practitioner and a _since parameter so we only pull records modified since our last sync. The server kicks off an async job and sends us a content-location header that we poll until the export is ready. Then we download the NDJSON file and process it in batches of 100. Much more efficient and resilient.

The tricky part was handling the ADT A08 messages for real-time updates. When a practitioner's credential status changes in the EHR, we get an HL7v2 ADT message (because of course the real-time feed is HL7v2 not FHIR, because healthcare). Specifically we care about A08 (update patient information) events that affect the PD1 segment (practitioner demographics). I wrote a parser for the HL7v2 message format that extracts the relevant fields and maps them to our internal credential schema. It's not pretty but it works.

Also fixed a race condition in the shift assignment websocket that's been bothering me for weeks. The bug: when two charge nurses accept the same open shift within a narrow time window (sub-200ms), both WebSocket connections were receiving "shift accepted" confirmations because the database update wasn't using row-level locking. Added a SELECT FOR UPDATE to the shift assignment transaction which serializes concurrent mutations on the same shift_id. It fixes the bug but I'm not thrilled about the lock contention implications if we ever need to handle hundreds of concurrent shift assignments. Might need to move to an optimistic concurrency control pattern with version vectors eventually.

PRs are up for both. Need reviews from Nelson on the FHIR refactor (it's a big diff, sorry) and from Kai on the websocket fix (he owns that part of the frontend).`,
  },
  {
    personEmail: "marcus@tensient.com",
    date: "2026-01-24T19:00:00Z",
    content: `Two main things this week. First: the credential matching fuzzy layer that Nelson asked for. The problem was that state nursing board records and hospital HR records frequently have name mismatches. Mary Smith in one system might be Mary J. Smith or Mary Johnson-Smith in another. Our strict matching was only getting 94% which sounds good but means 6% of nurses need manual intervention which at scale is hundreds of people.

I implemented a multi-layer matching approach: first try exact match on license number (catches 89%), then fall back to a composite score using Levenshtein distance on name fields, soundex matching for phonetic similarity, date of birth exact match, and state of licensure. The composite score needs to be above 0.85 to count as an auto-match. Also added some healthcare-specific normalization -- stripping credential suffixes (RN, BSN, MSN), expanding common abbreviations (Wm -> William, Chas -> Charles, etc.), and handling hyphenated/maiden names by matching on any component.

This got us from 94% to 97% auto-match. The remaining 3% are genuinely ambiguous cases that need human review -- things like two different nurses with the same name and similar credentials (it happens more than you'd think, especially common names in large systems). I added a confidence score to the match result so the frontend can display "high confidence" vs "needs review."

Second thing: started the SOC2 encryption migration. Our credential store is currently encrypted with AES-128-GCM. SOC2 requires AES-256. The migration itself is straightforward -- new encryption module, re-encrypt all existing records, rotate all KMS keys. The annoying part is making sure the FHIR adapter, the HR SFTP feed, and the manual upload flow all work with the new encryption because they all read/write to the credential store. I've got the new encryption module written and unit tested. Integration testing with all three data paths starts next week.

One thing that's bugging me: I've been the sole backend reviewer for all credential-related PRs because nobody else on the team understands the FHIR spec well enough. Maya is ramping but she's not there yet. I've been doing code reviews until 8pm most nights this week. I'm not complaining, I just want to flag that this is a bus factor risk. If I get sick, the credential work stops.`,
  },
  {
    personEmail: "marcus@tensient.com",
    date: "2026-02-03T17:30:00Z",
    content: `SOC2 encryption migration is in staging. Migrated the credential store from AES-128-GCM to AES-256-GCM with automatic key rotation every 90 days via AWS KMS. The migration script re-encrypted 48,000 existing credential records in about 12 minutes which is within our maintenance window tolerance.

The integration testing went mostly smooth with one annoying exception: the FHIR bulk export parser was breaking because I changed the field encryption scheme and forgot to update the decryption step in the NDJSON processor. Classic. Fixed it, added a regression test. The SFTP feed and manual upload both worked fine because they go through a different code path that I did remember to update.

Also shipped a retry queue for the state nursing board API rate limits. The implementation uses a Redis-backed job queue with configurable concurrency (default: 80 requests per minute, leaving headroom below their 100/min limit). Jobs that get 429'd are re-queued with exponential backoff (initial delay 1s, max delay 60s, max retries 5). There's a dead letter queue for jobs that exhaust all retries. I built a simple admin dashboard endpoint that shows queue depth, processing rate, and DLQ size.

Next up: Nelson asked me to fix the shift notification delay that Sam has been escalating about. I already know what the problem is -- it's the same websocket race condition pattern but in the notification fan-out. When a shift is assigned, we publish a notification to all nurses in the relevant unit. If there are 50 nurses in the unit, that's 50 simultaneous WebSocket messages, and our current implementation does them sequentially which creates a waterfall delay. The nurse at the end of the list might not get their notification for 5-10 seconds. Fix is to parallelize the fan-out. Should be a 1-day thing.

PR review queue is still a problem. I've got 4 open PRs that have been waiting for review for 3+ days each. Maya reviewed one of them but she's still learning the FHIR stuff and asked 11 questions, all valid, but it took me an hour to respond to all of them. Growing pains I guess.`,
  },
  {
    personEmail: "marcus@tensient.com",
    date: "2026-02-07T18:30:00Z",
    content: `Shipped three things this week. First, the websocket notification fan-out fix. Replaced the sequential loop with Promise.allSettled for parallel dispatch. Notification delivery time for a 50-nurse unit went from 5-8 seconds to under 200ms. Sam confirmed all three hospitals that reported the issue are now seeing instant notifications. Should have prioritized this earlier honestly, it was a quick fix.

Second, the KMS key rotation automation. Previously we had to manually rotate encryption keys through the AWS console. Now there's a Lambda function triggered by CloudWatch on a 90-day schedule that handles the rotation and re-encryption of active session tokens. The credential store re-encryption happens in a separate maintenance job because it's a heavier operation. All of this is logged for the SOC2 auditor.

Third, and this is the one I'm most proud of but nobody will ever see: I built a FHIR integration test harness that simulates different Epic installation configurations. We've been finding edge cases all month where different hospitals' Epic servers behave differently -- different FHIR spec compliance levels, different HL7v2 message formats, different rate limits. The harness lets us define a "hospital profile" with specific behaviors and run our entire adapter test suite against it. I loaded it with the 6 behavioral profiles we've encountered so far. All tests pass. Next time we onboard a hospital with a weird Epic configuration, we add their profile and run the suite. No more production surprises.

Still need someone to review the FHIR bulk export PR. It's been open for 8 days. Nelson said he'd look at it this weekend. Maya is close to being able to do FHIR reviews independently -- probably another 2 weeks. The bus factor thing I flagged in my last update is still a concern but at least there's a timeline for resolution.

One thing I want to raise: we don't have any load testing for the credential verification system. We've tested it with Adventist's 2000 nurses but some of our target customers are 10x that size. I'd feel a lot better if we ran a load test simulating 20,000 nurses before we start onboarding larger systems. Putting this on the Q2 backlog.`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PRIYA PATEL (Product Marketing) -- 4 captures, ~every 10 days
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "priya@tensient.com",
    date: "2026-01-08T10:00:00Z",
    content: `Super excited to kick off Q1! I've been working on the messaging framework for our credential verification product and I really think we've landed on something powerful. The core narrative is "from firefighting to foresight" -- the idea that hospitals are currently reacting to credential issues after they become problems (expired licenses, missed verifications, audit findings) and we shift them to a proactive posture where they see everything in real time and act before problems happen.

I tested this messaging with 3 hospital ops leaders over the holiday break (just casual conversations, not formal research) and it resonated really strongly. One of them literally said "that's exactly the problem, we're always firefighting." So I think we've got the positioning right.

For the competitive landscape, I've been mapping our narrative against the main alternatives. Most of the legacy credential verification solutions (like HealthStream and Symplr) are basically database products -- they store credentials but they don't DO anything with them proactively. They don't integrate with scheduling, they don't alert before expirations, and they definitely don't auto-verify against state boards. Our differentiation is the intelligence layer -- we don't just store credentials, we actively monitor, verify, and act on them. This is the "staffing intelligence" positioning that Nelson talks about and I think it's really compelling.

I'm also starting to think about the case study strategy. If the Adventist Health pilot goes well (and it sounds like it's going to based on what Nelson is saying), that's our first proof point. I want to start building the case study framework now -- the before/after story, the metrics, the quotes -- so we can move fast when the data is in. I reached out to their communications team to get approval for a co-branded case study and they're "open to it."

One thing I want to push on: our website still describes us as a "staffing platform" which undersells what we're becoming. I think we should update the positioning to "healthcare operations platform" or "operational intelligence for healthcare." Going to mock up some website copy alternatives and share with Rachel.`,
  },
  {
    personEmail: "priya@tensient.com",
    date: "2026-01-20T13:00:00Z",
    content: `The Adventist Health case study is coming together and I am SO excited about the quotes we're getting. I did a 30-minute interview with their Director of Nursing last Friday and she said -- and this is a direct quote -- "Before Tensient, credential verification was my least favorite part of the job. I'd spend hours on the phone with the state board, cross-referencing spreadsheets, praying I didn't miss something. Now I just look at the dashboard. It's like someone turned the lights on." I mean, COME ON. That's marketing gold right there.

I also talked to one of the charge nurses who's been using the credential dashboard and she said "I used to keep a paper list of whose licenses were expiring because I didn't trust the system. Now I don't need the list anymore." The trust angle is huge -- we're not just saving time, we're building trust in the system, which is incredibly powerful in healthcare where the consequences of mistakes are literally life and death.

For the messaging framework, I've created three tiers: (1) the executive elevator pitch (30 seconds, for CNOs and CFOs), (2) the product overview (2 minutes, for demo calls and website), and (3) the technical differentiation (5 minutes, for evaluations against competitors). Each tier uses the "firefighting to foresight" narrative but with different levels of detail and different proof points.

I also drafted a "State of Healthcare Credential Management" report concept. The idea is to survey 100 hospital ops leaders about their credential management challenges and publish the results as a thought leadership piece. This would give us a content asset for top-of-funnel, establish us as an authority in the space, and generate leads. Rachel loves the idea. I need about $15K for the survey platform and promotion. Going to request budget in the next leadership meeting.

Other things: the sales deck needs updated screenshots because Kai shipped a new version of the credential dashboard last week. Need to coordinate with him. Also need to start thinking about the compliance automation launch messaging -- Rachel mentioned this is becoming official soon and I want to be ready.`,
  },
  {
    personEmail: "priya@tensient.com",
    date: "2026-01-31T10:00:00Z",
    content: `OK so compliance automation is officially happening and I am THRILLED. This is exactly the kind of product expansion story that makes the market take notice. We're not just a staffing tool anymore -- we're becoming the operational backbone for healthcare.

I've already started on the launch plan. Here's my thinking: we do a three-wave launch. Wave 1 is a teaser -- blog post about "the hidden cost of manual compliance" with some of the data from Rachel's customer discovery calls (anonymized of course). Wave 2 is the product announcement with the waitlist page. Wave 3 is the beta launch with the first pilot customers. Each wave builds on the previous one and creates escalating buzz.

For the product one-pager, I'm framing compliance automation as "the natural evolution of credential verification." If we're already monitoring credentials in real-time, extending that to broader compliance categories (training certifications, OSHA requirements, department-specific credentials, audit documentation) is a logical next step. The value prop is: one dashboard to rule them all. I think that messaging is going to be incredibly powerful for hospital CFOs who are currently stitching together 5 different systems to get a compliance picture.

I'm also developing a webinar series concept: "The Modern Hospital Compliance Stack." Three episodes: (1) Why manual compliance is a ticking time bomb, (2) How credential verification changes the game, (3) The future of automated compliance. We'd feature our own product obviously but also bring in hospital leaders as guest speakers. Thinking Adventist Health would be a great first guest since they're already bought in.

The case study from Adventist is nearly done! I've got the quotes, the narrative, and the metrics framework. Just waiting for the 30-day data milestone to finalize the numbers. I CANNOT WAIT to publish this. It's going to be so good.

Quick ask: I need updated product screenshots from Kai for the sales deck and the case study. The current ones are from December and the UI has changed a lot. Also need Nelson to approve the technical claims in the case study -- I want to make sure I'm not overselling anything (I've been told I have a tendency to do that lol but in this case the product really IS that good).`,
  },
  {
    personEmail: "priya@tensient.com",
    date: "2026-02-06T11:30:00Z",
    content: `Brand refresh week! I've been working on evolving our visual identity to feel more premium and enterprise-ready. The current brand feels a bit too "startup scrappy" for the hospitals we're selling into. CNOs and CFOs at major health systems want to see a brand they can trust with patient safety-related workflows, not a brand that looks like it was designed at a hackathon (no offense to our original brand, it served us well).

The new direction keeps our core color palette but introduces a more refined typography system and a cleaner, more structured layout language. I'm also developing a set of healthcare-specific icons and illustrations -- things like credential badges, compliance shields, scheduling calendars. The goal is to feel both modern/tech-forward AND trustworthy/institutional. It's a fine line but I think we're nailing it.

I showed the direction to Rachel and she loved it. She said "this is the brand of a company that hospital systems trust with their most critical workflows" which is literally our vision statement so, yeah, I think we're on the right track.

For the compliance automation launch: the teaser blog post is drafted and ready for review. Title: "The Hidden $2.4M Cost of Manual Compliance in Healthcare." I calculated that number from the customer discovery data -- average hospital system spends $2.4M annually on manual compliance processes across credentialing, training tracking, audit prep, and regulatory reporting. It's a big number and I think it'll get attention.

One challenge: I need product screenshots for like 4 different pieces of collateral (sales deck, case study, blog posts, one-pager) and I keep asking Kai but he says the UI is "still changing." I get that engineering is iterative but marketing needs something to show. Can we agree on a screenshot freeze date? Even if the product changes after that, at least I'll have assets I can work with.

Also: the thought leadership survey is approved! Budget is allocated. I'm working with a research partner to design the questionnaire. Target: 100 hospital ops leaders. Timeline: field in February, publish in March. This is going to be such a great content piece.`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SAM OKAFOR (Customer Success Lead) -- 4 captures, irregular
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "sam@tensient.com",
    date: "2026-01-09T16:00:00Z",
    content: `Q1 account health review. Looking at my full book of business and trying to be honest about where things stand. I've got 22 active accounts. Here's the breakdown:

Green (healthy, no issues): 11 accounts. These are mostly our smaller hospitals that have been with us for 6+ months and are humming along. They use the staffing product, it works, they renew without drama. I do quarterly check-ins and that's enough.

Yellow (needs attention): 7 accounts. Most of these are mid-market hospitals that are using about 60-70% of what they're paying for. They haven't expanded to additional departments and there's risk of downsizing at renewal. I need to do deeper engagement with each of them to understand what's blocking adoption. Some of it is change management -- the staff in other departments don't want to learn a new system. Some of it is integration issues -- their EHR setup makes it harder to add new departments.

Red (at risk): 4 accounts. These are the ones keeping me up at night.

Memorial Health is the biggest concern. Their longtime CTO just retired and the new one is doing a full vendor review. Our champion (the VP of Nursing Operations) is still there and supportive but she's being cautious because the political winds have shifted. I've been trying to get a meeting with the new CTO but he keeps rescheduling. We need Rachel to do an executive outreach here because I don't think my level of contact is going to be enough.

Kaiser Oakland is unhappy about the downtime incident from December. They want a 15% discount on their renewal as "compensation." I think we can negotiate this down but it's a tough conversation. Their renewal is in March.

St. David's Austin is just... not using the product. Usage has dropped 40% in the last 2 months and I can't figure out why. Multiple emails and calls unreturned. I'm worried they're evaluating alternatives.

Northwell is technically yellow but trending red. They opened 3 support tickets about shift notification delays and none of them have been resolved. It's been 2 weeks. I've escalated to Nelson but eng is focused on the credential stuff. I understand priorities but these are customers with live issues and every day that goes by erodes trust.

I need help. 22 accounts is too many for one person, especially with 4 of them in crisis mode. I keep asking for a second CSM hire but it keeps getting deprioritized.`,
  },
  {
    personEmail: "sam@tensient.com",
    date: "2026-01-22T15:00:00Z",
    content: `Memorial Health situation is getting worse. I finally got the meeting with the new CTO -- Victor Park -- and it was... rough. He came in with a spreadsheet comparing us to three competitors (Symplr, HealthStream, and QGenda) on 47 different features. He's clearly done his homework. The good news is we won on 30 of the 47 features. The bad news is the 17 we lost on include some enterprise features that big health systems care about a lot -- SSO integration, custom reporting, multi-entity consolidation. We have some of these on the roadmap but they don't exist today.

I asked Jordan to help me prepare a proper QBR deck that focuses on ROI delivered rather than feature comparison, because that's where we actually win. Jordan pulled together usage data showing 3,200 shifts processed, 89% auto-assigned, estimated 420 hours of manual scheduling saved since they went live. That's compelling. But Victor is a "show me the features" guy, not a "show me the ROI" guy. Different buying persona than we're used to.

The other red accounts are holding steady (meaning not getting better but not getting worse). Kaiser renewal negotiation is ongoing -- I'm trying to hold the line at 5% discount. St. David's finally returned my call and it turns out their main user (the staffing coordinator) went on maternity leave and nobody picked up her responsibilities. So the product isn't being used because there's literally nobody assigned to use it. They need onboarding for a replacement user. I scheduled that for next week.

On the ticket backlog: the shift notification issue is STILL unresolved. I've now escalated three times. Nelson said it's a websocket race condition and Marcus has a fix ready but it hasn't been deployed because the deployment pipeline is backed up with the encryption migration. I don't want to be dramatic but this is directly impacting 3 accounts and every week it goes unresolved is a week of eroded trust. I've been doing manual workarounds for all of them -- literally watching for stuck notifications and manually triggering them -- which takes about an hour a day.

Honestly feeling pretty burned out right now. The ratio of firefighting to strategic account development is like 80/20 when it should be 20/80. I know the product team has a million things going on but the customer experience is suffering and I'm the one hearing about it every day.`,
  },
  {
    personEmail: "sam@tensient.com",
    date: "2026-02-04T14:00:00Z",
    content: `OK so the notification issue is FINALLY fixed as of yesterday. Marcus shipped the websocket fix and all three hospitals confirmed it's working. That's a huge relief. But I want to be honest: 3 weeks to fix a customer-impacting bug is too long. We need a better process for triaging customer issues vs feature work. I shouldn't have to escalate three times to get a production bug fixed.

Memorial Health QBR happened. Mixed results. The ROI data landed well -- Dr. Watkins (CNO, our champion) was visibly impressed by the 420 hours saved number and said "this is exactly what we need to show the finance committee." But Victor (new CTO) kept pushing on the feature gaps. He specifically asked about SSO, custom reporting, and multi-entity consolidation. I told him SSO is on the Q2 roadmap and custom reporting is being explored. He said "explored is not a commitment" and he's right. I need Jordan or Nelson to give me firm dates I can share.

Small win on the Kaiser renewal: negotiated the discount down to 5% from their ask of 15%. Their COO signed the renewal yesterday. Revenue impact is minimal and we kept the logo. I'll take it.

St. David's: did the onboarding session with the replacement staffing coordinator. She's great actually -- more tech-savvy than the previous person and she immediately saw the value. Usage is already trending back up. Crisis averted but it revealed a vulnerability: our product is too dependent on a single power user at each hospital. If that person leaves, adoption collapses. We need better self-service onboarding and documentation.

The Adventist pilot data is a bright spot in my world right now. When I talk to other customers about credential verification, they get excited. Three of my yellow accounts have expressed interest in piloting it. If we can expand them from staffing-only to staffing+credentials, that's a real expansion win and it changes the renewal dynamic completely.

I'm still at 22 accounts with no help in sight. Rachel mentioned possibly hiring a second CSM in Q2 but that's 2 months away. I'm managing but barely.`,
  },
  {
    personEmail: "sam@tensient.com",
    date: "2026-02-07T12:00:00Z",
    content: `Couple of updates on the account front.

Good news: Kaiser renewal is fully closed and locked in. The 5% discount stung a little but keeping the logo and ARR was the right call. The COO actually said in the signing call that they're interested in credential verification when it's available for their system. So the renewal conversation turned into an expansion opportunity. Sometimes you gotta play the long game.

Concerning news: I heard through a back channel that Adventist Health's HR Director mentioned to their vendor management team that they're "evaluating a competitor for the compliance piece specifically." This is the first I've heard of it and it worries me because the Adventist relationship is supposed to be our flagship. The competitor is apparently Symplr, which makes sense because they have a more mature compliance product. But we're about to launch compliance automation! I need to make sure the Adventist team knows what's coming so they don't make a decision before they see our product.

I raised this with Jordan and she said she'll coordinate with Priya on getting some early messaging about compliance automation to the Adventist team. But I think we need to move faster than a marketing drip campaign. I want to set up a meeting with their VP of Ops to give them a preview of the compliance roadmap. If they know it's coming, they'll wait. If they don't know, they'll buy Symplr and then we've lost the expansion opportunity.

Memorial Health: still in limbo. Victor hasn't responded to my follow-up from the QBR. Dr. Watkins tells me he's busy with other vendor reviews (not just us). I'm choosing to interpret that as "we're not the top priority for elimination" which is the best spin I can put on it.

The St. David's recovery is going well -- usage is back to 80% of pre-leave levels and trending up. The new staffing coordinator asked if we have training videos and I had to tell her "not really, just some knowledge base articles." We really need better self-service education content. Going to flag this for Jordan as a product gap.

End of day honest assessment: I feel less underwater than I did two weeks ago. The notification fix helped a lot. The Kaiser close was a confidence boost. But I'm still stretched too thin and the Memorial and Adventist situations both need more senior attention than I can provide alone.`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // KAI NGUYEN (Frontend Engineer) -- 4 captures, moderate
  // ═══════════════════════════════════════════════════════════════════════
  {
    personEmail: "kai@tensient.com",
    date: "2026-01-08T16:00:00Z",
    content: `First week back and I'm diving into the credential dashboard frontend. Alex gave me the mockups on Monday and they look really good -- clean card layout, nice status indicators, the expiration countdown thing is cool. I started building the base components: NurseCard, CredentialBadge, StatusIndicator, and the main CredentialDashboard page layout.

The NurseCard is done and I'm pretty happy with it. Each card shows the nurse's name, unit, photo (if available), and a row of credential badges that show green/yellow/red based on verification status. I used CSS Grid for the card layout which makes it responsive without a lot of media queries. The badge components are reusable which is nice because I think we'll need them in other places too.

I ran into an issue with the real-time status updates though. Marcus's backend sends WebSocket events when a credential verification completes, but the event payload only includes the credential ID and new status -- not the full nurse data. So I need to either fetch the full nurse record on each event (expensive) or maintain a client-side cache that I merge the updates into (complex). I went with the client-side cache approach using React context but I'm not 100% sure it's the right call. There might be edge cases where the cache gets stale. I'll keep testing.

Also started looking at the data table for the admin view -- where hospital admins can see all nurses and their credential statuses at a glance. Alex designed it as a sortable table with filtering. I'm using the TanStack Table library which I've used before and it's good for this kind of thing. Just need to figure out the server-side pagination because some hospitals have thousands of nurses.

One thing I'm a bit worried about: the mockups show some animations -- like the credential badge should pulse when it's being verified and there's a confetti animation when all credentials for a nurse are verified. These look great in the design but animations in React can be tricky and I don't want them to impact scroll performance on the table view. Going to implement them last and see if the performance is acceptable.

Not sure what my priority order should be. There's the dashboard cards, the admin table, the real-time updates, and the animations. I'm guessing the dashboard cards are most important for the pilot? I'll ask Jordan.`,
  },
  {
    personEmail: "kai@tensient.com",
    date: "2026-01-17T15:00:00Z",
    content: `Making progress on the credential dashboard but hitting some bumps. The card component and admin table are both functional now. I shipped the card component to staging on Wednesday and Jordan tested it with the Adventist Health data. Her feedback was mostly positive but she wants the expiration countdown to be more prominent -- Alex is updating the design and I'll implement the change.

The admin table was more work than I expected. TanStack Table is powerful but the documentation is kind of scattered and I spent half a day figuring out how to make server-side sorting work with our REST API. Got it working but the pagination UX is a bit janky -- when you change pages there's a noticeable loading flash. I think I need to implement optimistic updates or at least a skeleton loader. Adding that to my list.

The bigger issue this week was a rendering bug that had me stuck for almost a full day. The chart library I'm using (recharts) for the credential trends view was rendering empty on initial load but fine after a browser resize. Classic. Turned out it was a timezone conversion issue -- the chart was calculating the x-axis domain using UTC timestamps but the render was happening before the timezone offset was applied, so the domain was empty. Fixed it by normalizing all timestamps to UTC before passing them to the chart component. Not hard but annoying to diagnose.

I'm also a little worried about the bundle size. Before I started, the main bundle was 340kb gzipped. Now it's 478kb. The big additions are TanStack Table (60kb), the chart library (52kb), and the WebSocket client (26kb). Is that too much? I'm not sure what our performance budget is. The credential dashboard is loading in about 1.2 seconds on my machine which seems fine but I don't know what the hospital networks are like -- I've heard some hospitals are still on terrible WiFi. Maybe I should ask Nelson if we have performance requirements.

Quick question for Marcus: the WebSocket reconnection logic seems fragile. If the connection drops (which happens often on hospital WiFi), the client tries to reconnect 3 times with 1-second intervals and then gives up. Should it keep retrying indefinitely? Should there be a user-visible indicator when the connection is down? I don't want nurses to think their dashboard is up to date when it's actually showing stale data.`,
  },
  {
    personEmail: "kai@tensient.com",
    date: "2026-01-29T14:30:00Z",
    content: `Accessibility audit week. Alex wrote up a spec for the keyboard navigation and ARIA roles needed for the credential dashboard and shift calendar. I started working through it and... there's a lot more to accessibility than I realized.

The credential dashboard itself is in OK shape. The card components have proper heading hierarchy, the status badges have aria-labels, and the admin table is built on native HTML table elements which get a lot of accessibility for free. The main issues are: (1) the credential badge colors don't have enough contrast (Alex is fixing the design tokens), (2) the sorting buttons on the table don't announce the current sort direction to screen readers, and (3) the real-time updates don't get announced -- when a credential status changes, a sighted user sees the badge animate but a screen reader user gets nothing. I need to add an aria-live region for status changes.

The shift calendar is a different story. It's a drag-and-drop grid where charge nurses assign nurses to shift slots. Drag-and-drop has no native keyboard equivalent. I need to implement keyboard navigation (arrow keys to move between cells, Enter to select, Escape to cancel, and some way to "pick up" and "drop" a nurse into a slot). Alex's spec suggests using Tab to focus slots and Space to toggle selection mode but I'm not sure that conflicts with the browser's native tab behavior.

I spent a couple hours researching how other apps handle accessible drag-and-drop. The best example I found is Atlassian's drag-and-drop library (react-beautiful-dnd) which has good keyboard support. But it's designed for lists, not grids. The grid pattern is harder. Might need to pair with Marcus on this because it involves the underlying data model -- when you move a nurse from one slot to another, you're actually creating/updating shift assignment records.

The font size issue from the Adventist nurse feedback is also on my plate. Alex asked me to add a user preference for font size scaling on data-dense screens. I'm thinking of using a CSS custom property that scales the base rem value. Haven't started this yet though.

I'm trying to prioritize but everything feels urgent. The accessibility stuff is technically required for the WCAG certification (SOC2 related?), the font size thing is a customer request, and I still need to add the skeleton loaders for the admin table. Would really help to have a conversation with Nelson or Jordan about what to focus on first.`,
  },
  {
    personEmail: "kai@tensient.com",
    date: "2026-02-06T16:00:00Z",
    content: `So the compliance module shipped to staging this week and it added 170kb to our JavaScript bundle. We're now at 510kb gzipped for the main bundle. I profiled it and the biggest culprit is the compliance rules engine -- it's a JSON schema-based validator that runs client-side to show real-time compliance status as the user fills out forms. The schema definitions alone are 80kb because healthcare compliance rules are incredibly detailed (like, there are 47 different types of nursing credentials in California alone and each one has different renewal requirements).

I've been thinking about how to fix this. Option 1: lazy-load the compliance module so it only loads when you navigate to the compliance section. This would keep the initial bundle at 340kb for users who are only using the staffing features. Option 2: move the compliance rules to the server and do the validation via API calls instead of client-side. This would eliminate the schema download but add latency to every form interaction. Option 3: split the rules by state so we only download the rules for the states the hospital operates in. Most hospitals are in 1-3 states so this could reduce the schema from 80kb to 5-15kb.

I'm leaning toward Option 1 (lazy loading) because it's the simplest and doesn't change the architecture. But I want to ask Nelson before I commit to it because there might be performance implications I'm not thinking of.

On the accessibility front: I finished the aria-live region for credential status changes and the screen reader announcements for table sorting. The shift calendar keyboard navigation is about 60% done -- basic cell navigation works with arrow keys but the "pick up and drop" interaction still needs work. The biggest challenge is communicating the state to screen readers: when you're in "moving mode" and navigating to a target cell, the screen reader needs to announce what you're moving and where you're about to drop it. There's a lot of ARIA state management.

Also: Priya keeps asking me for product screenshots and I keep telling her the UI is changing. But honestly, the credential dashboard is pretty stable at this point. I should just give her the screenshots. Going to do that tomorrow.

Small win: the skeleton loaders for the admin table are done and they look great. The loading experience went from "white screen for 1.2 seconds" to "graceful fade-in of placeholder rows that morph into real data." Little things like this make me feel like a real frontend engineer.`,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// AI Processing (inline versions of services to avoid @/ path issues)
// ═══════════════════════════════════════════════════════════════════════

async function seedRunStrategy(workspaceId: string, rawInput: string) {
  console.log("   Extracting strategic pillars via Anthropic...");

  const parsed = await generateStructuredJSON<{
    pillars: string[];
    tone: string;
    synthesis: string;
  }>({
    prompt: `You are a strategic advisor. Given a leader's raw strategic input, extract:
1. The core 3-5 strategic pillars (concise, actionable statements)
2. The overall tone (one of: "wartime", "peacetime", "analytical", "growth")
3. A synthesized strategy document (2-3 paragraphs)

Here is the strategic input:

${rawInput}`,
    schema: {
      type: "object",
      properties: {
        pillars: { type: "array", items: { type: "string" } },
        tone: { type: "string", enum: ["wartime", "peacetime", "analytical", "growth"] },
        synthesis: { type: "string" },
      },
      required: ["pillars", "tone", "synthesis"],
      additionalProperties: false,
    },
    temperature: 0.3,
  });

  const { pillars, tone, synthesis } = parsed;

  console.log("   Generating strategy embedding...");
  const embedding = await generateEmbedding(synthesis);

  const [canon] = await db
    .insert(canons)
    .values({ workspaceId, content: synthesis, embedding, rawInput })
    .returning();

  // Auto-select protocol by tone
  const toneToCategory: Record<string, string> = {
    wartime: "strategy",
    peacetime: "leadership",
    analytical: "leadership",
    growth: "personal",
  };
  const category = toneToCategory[tone] || "leadership";
  const [protocol] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.category, category))
    .limit(1);

  if (protocol) {
    await db
      .update(workspaces)
      .set({ activeProtocolId: protocol.id, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  }

  return { canon, pillars, tone, protocol };
}

async function seedProcessCapture(
  userId: string,
  workspaceId: string,
  content: string,
  canonId: string | null,
  canonEmbedding: number[] | null,
  captureDate: Date,
) {
  // 1. Create capture
  const [capture] = await db
    .insert(captures)
    .values({ userId, workspaceId, content, source: "web" })
    .returning();

  // 2. Embedding
  const captureEmbedding = await generateEmbedding(content);

  // 3. Drift score
  let driftScore = 0.5;
  if (canonEmbedding) {
    const similarity = cosineSimilarity(captureEmbedding, canonEmbedding);
    driftScore = Math.max(0, Math.min(1, 1 - similarity));
  }

  // 4. LLM analysis
  const parsed = await generateStructuredJSON<{
    sentiment_score: number;
    action_items: Array<{ task: string; status: string }>;
    synthesis: string;
    feedback: string;
  }>({
    prompt: `You are an organizational intelligence agent. Analyze this employee update and extract:
1. sentiment_score: Float from -1.0 (very negative) to 1.0 (very positive)
2. action_items: Array of objects with task and status fields
3. synthesis: A clean, professional summary of the update (2-3 sentences)
4. feedback: Coaching advice for the employee (1-2 sentences). Be direct and actionable.

Here is the employee update:

${content}`,
    schema: {
      type: "object",
      properties: {
        sentiment_score: { type: "number" },
        action_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task: { type: "string" },
              status: { type: "string", enum: ["open", "blocked", "done"] },
            },
            required: ["task", "status"],
            additionalProperties: false,
          },
        },
        synthesis: { type: "string" },
        feedback: { type: "string" },
      },
      required: ["sentiment_score", "action_items", "synthesis", "feedback"],
      additionalProperties: false,
    },
    temperature: 0.3,
  });

  // 5. Create artifact
  const [artifact] = await db
    .insert(artifacts)
    .values({
      captureId: capture.id,
      canonId,
      driftScore,
      sentimentScore: parsed.sentiment_score || 0,
      content: parsed.synthesis || content,
      actionItems: parsed.action_items || [],
      feedback: parsed.feedback || "",
      embedding: captureEmbedding,
    })
    .returning();

  // 6. Mark processed + backdate
  await db
    .update(captures)
    .set({ processedAt: captureDate, createdAt: captureDate })
    .where(eq(captures.id, capture.id));

  await db
    .update(artifacts)
    .set({ createdAt: captureDate })
    .where(eq(artifacts.id, artifact.id));

  const alignmentScore = Math.round((1 - driftScore) * 100) / 100;

  return {
    capture,
    artifact,
    alignmentScore,
    sentimentScore: parsed.sentiment_score || 0,
    actionItems: parsed.action_items || [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Main seed function
// ═══════════════════════════════════════════════════════════════════════

async function seedDemo() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed scripts must not run in production. Set NODE_ENV to 'development' or 'test'.");
  }

  console.log("=== Seeding Tensient Health demo data ===\n");

  // ── Step 1: Create organization ───────────────────────────────────
  console.log("1. Creating organization...");
  const [org] = await db
    .insert(organizations)
    .values({ name: "Tensient Health" })
    .returning();
  console.log(`   OK Organization: ${org.id}\n`);

  // ── Step 2: Create users ──────────────────────────────────────────
  console.log("2. Creating users...");
  const userMap: Record<string, string> = {};

  for (const persona of PERSONAS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, persona.email))
      .limit(1);

    if (existing) {
      userMap[persona.email] = existing.id;
      console.log(`   = ${persona.firstName} ${persona.lastName} (${persona.email}) -- already exists`);
    } else {
      const passwordHash = await hash(persona.password, 12);
      const [user] = await db
        .insert(users)
        .values({
          email: persona.email,
          firstName: persona.firstName,
          lastName: persona.lastName,
          passwordHash,
          organizationId: org.id,
        })
        .returning();
      userMap[persona.email] = user.id;
      console.log(`   + ${persona.firstName} ${persona.lastName} (${persona.email})`);
    }
  }
  console.log();

  // ── Step 3: Create workspace ──────────────────────────────────────
  console.log("3. Creating workspace...");
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: "Tensient Health Product & Engineering",
      organizationId: org.id,
      joinCode: nanoid(8),
    })
    .returning();
  console.log(`   OK Workspace: ${workspace.id}`);
  console.log(`   OK Join code: ${workspace.joinCode}\n`);

  // ── Step 4: Create memberships ────────────────────────────────────
  console.log("4. Creating memberships...");
  for (const persona of PERSONAS) {
    await db.insert(memberships).values({
      userId: userMap[persona.email],
      workspaceId: workspace.id,
      role: persona.role,
    });
    console.log(`   + ${persona.firstName} (${persona.role})`);
  }
  console.log();

  // ── Step 5: Set goals via AI ──────────────────────────────────────
  console.log("5. Setting goals (running AI strategy extraction)...");
  const strategyResult = await seedRunStrategy(workspace.id, GOALS_RAW_INPUT);
  console.log(`   OK Canon created: ${strategyResult.canon.id}`);
  console.log(`   OK Pillars: ${strategyResult.pillars.length}`);
  console.log(`   OK Tone: ${strategyResult.tone}`);
  console.log(`   OK Auto-selected protocol: ${strategyResult.protocol?.name || "none"}`);

  // ── Step 6: Override protocol to Jensen T5T ───────────────────────
  console.log("\n6. Setting protocol to Jensen T5T...");
  const [jensenProtocol] = await db
    .select({ id: protocols.id, name: protocols.name })
    .from(protocols)
    .where(eq(protocols.name, "Jensen T5T"))
    .limit(1);

  if (jensenProtocol) {
    await db
      .update(workspaces)
      .set({ activeProtocolId: jensenProtocol.id, updatedAt: new Date() })
      .where(eq(workspaces.id, workspace.id));
    console.log(`   OK Active protocol: Jensen T5T (${jensenProtocol.id})`);
  } else {
    console.log("   WARN Jensen T5T not found -- using auto-selected protocol");
  }
  console.log();

  // ── Step 7: Process all captures ──────────────────────────────────
  console.log(`7. Processing ${CAPTURES.length} captures through AI pipeline...\n`);

  const canonEmbedding = strategyResult.canon.embedding as number[] | null;

  for (let i = 0; i < CAPTURES.length; i++) {
    const entry = CAPTURES[i];
    const userId = userMap[entry.personEmail];
    const persona = PERSONAS.find((p) => p.email === entry.personEmail)!;
    const captureDate = new Date(entry.date);
    const dateStr = captureDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    process.stdout.write(
      `   [${String(i + 1).padStart(2)}/${CAPTURES.length}] ${persona.firstName.padEnd(8)} ${dateStr.padEnd(8)} `
    );

    try {
      const result = await seedProcessCapture(
        userId,
        workspace.id,
        entry.content,
        strategyResult.canon.id,
        canonEmbedding,
        captureDate,
      );

      console.log(
        `-> ${Math.round(result.alignmentScore * 100)}% aligned, sentiment ${result.sentimentScore.toFixed(2)}, ${result.actionItems.length} actions`
      );

      // Small delay to avoid hitting Gemini rate limits
      if (i < CAPTURES.length - 1) {
        await sleep(1000);
      }
    } catch (error) {
      console.log(`X ERROR: ${error instanceof Error ? error.message : "unknown"}`);
      // Wait longer on error (might be rate limit)
      await sleep(5000);
    }
  }

  // ── Step 8: Update membership timestamps ──────────────────────────
  console.log("\n8. Updating membership timestamps...");
  for (const persona of PERSONAS) {
    const personCaptures = CAPTURES.filter((c) => c.personEmail === persona.email);
    if (personCaptures.length > 0) {
      const lastDate = new Date(personCaptures[personCaptures.length - 1].date);

      const [membership] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.userId, userMap[persona.email]))
        .limit(1);

      if (membership) {
        await db
          .update(memberships)
          .set({
            lastCaptureAt: lastDate,
            streakCount: personCaptures.length,
            updatedAt: lastDate,
          })
          .where(eq(memberships.id, membership.id));
        console.log(`   OK ${persona.firstName}: ${personCaptures.length} captures, last ${lastDate.toLocaleDateString()}`);
      }
    }
  }

  // ── Done! ─────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log("Demo seed complete!");
  console.log(`   Workspace ID: ${workspace.id}`);
  console.log(`   Dashboard URL: /dashboard/${workspace.id}`);
  console.log(`   Sign in as: nelson@tensient.com / <SEED_PASSWORD>`);
  console.log("===============================================================\n");
}

seedDemo().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
