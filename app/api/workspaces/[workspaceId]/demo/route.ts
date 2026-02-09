import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, inArray } from "drizzle-orm";
import {
  workspaces,
  canons,
  captures,
  artifacts,
  memberships,
  protocols,
} from "@/lib/db/schema";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

// ── Pre-computed demo data ──────────────────────────────────────────

const DEMO_CANON_RAW_INPUT = `We need to ship the mobile app by end of March. The payment integration with Stripe is our biggest risk -- their API has rate limits we didn't account for. Quality matters more than speed right now. I'd rather slip a week than ship something buggy to our enterprise customers. The new hire on the mobile team is ramping but needs pairing. Also keep an eye on churn -- three enterprise accounts mentioned budget pressure in renewal calls last week.`;

const DEMO_CANON_CONTENT = `The team's strategic focus centers on three core pillars. First, the mobile app must ship by end of March with payment integration as the critical path -- the Stripe API rate limiting issue requires immediate engineering escalation. Second, quality takes precedence over velocity: the team is authorized to slip timelines rather than ship defects to enterprise customers. Third, retention risk is elevated: three enterprise accounts have flagged budget pressure during renewal conversations, requiring proactive outreach from account management. Supporting priorities include accelerating the new mobile hire's ramp-up through structured pairing sessions and establishing a weekly churn-signal review cadence.`;

const DEMO_CAPTURES = [
  {
    content: `Spent most of the week on the mobile checkout flow. Got the basic Stripe integration working -- tokenization and payment intent creation are solid. Hit a snag with the webhook handler for subscription renewals but figured it out by Thursday. Also paired with the new hire on the native navigation stack, she's picking it up fast. Planning to start integration tests for the payment flow next week.`,
    synthesis: `Mobile checkout flow progressing well. Stripe integration (tokenization, payment intents) is functional. Resolved webhook handler issue for subscription renewals by Thursday. Paired with new hire on native navigation -- onboarding ahead of schedule. Integration tests for payment flow planned for next week.`,
    driftScore: 0.12,
    sentimentScore: 0.6,
    actionItems: [
      { task: "Complete integration tests for payment flow", status: "open" },
      { task: "Continue pairing sessions with new hire", status: "open" },
      { task: "Stripe webhook handler for renewals", status: "done" },
    ],
    feedback:
      "Strong alignment with the mobile shipping priority. The pairing investment in the new hire will pay dividends. Consider flagging the webhook issue in your next team sync -- if it took days to resolve, others might hit the same wall.",
  },
  {
    content: `Kind of a scattered week. Started refactoring the auth module because the token refresh logic was getting messy. Took longer than expected -- probably 3 days on it. Also looked into switching our state management from Redux to Zustand because a blog post made it look way cleaner. Didn't get to the payment error handling that was on my plate. Will try to catch up next week.`,
    synthesis: `Week spent primarily on auth module refactoring (token refresh logic, ~3 days) and evaluating Redux-to-Zustand migration. Payment error handling -- a committed deliverable -- was not started. Priorities appear misaligned with the team's mobile shipping focus.`,
    driftScore: 0.45,
    sentimentScore: 0.1,
    actionItems: [
      { task: "Complete payment error handling (carried over)", status: "open" },
      { task: "Auth token refresh refactor", status: "done" },
      {
        task: "Zustand migration evaluation -- needs team discussion before proceeding",
        status: "blocked",
      },
    ],
    feedback:
      "The auth refactor may have been necessary, but spending 3 days on it while payment error handling sat untouched is a prioritization miss. The Zustand exploration wasn't on anyone's radar -- bring architectural changes to the team before investing time. Focus next week exclusively on payment error handling.",
  },
  {
    content: `I've been thinking a lot about our design system. We should really standardize our component library before we scale the mobile app. I spent the week building a Storybook setup and documenting our color tokens. Also started sketching ideas for a dark mode toggle. I think it could be a differentiator for our enterprise customers. Didn't really touch any of the sprint tickets though.`,
    synthesis: `Entire week spent on design system infrastructure (Storybook setup, color token documentation, dark mode exploration) with zero sprint ticket progress. While design system investment has long-term value, this work was not prioritized and is not aligned with the current mobile shipping deadline.`,
    driftScore: 0.78,
    sentimentScore: 0.3,
    actionItems: [
      {
        task: "Return to sprint tickets immediately -- mobile app is the priority",
        status: "open",
      },
      {
        task: "Storybook setup -- park until post-launch",
        status: "blocked",
      },
      {
        task: "Dark mode toggle -- add to backlog for Q2",
        status: "blocked",
      },
    ],
    feedback:
      "This is a significant drift from the team's strategic focus. Design system work is valuable but not urgent -- the mobile app ships in weeks, not months. Every day spent on Storybook is a day not spent on the critical path. Recommend re-reading The Canon and aligning next week's work to the top priority.",
  },
];

// ── POST: Insert demo data ──────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  // Verify workspace exists and user is a member
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, session.user.id),
        eq(memberships.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Don't double-insert demo data
  if (workspace.isDemo) {
    return NextResponse.json({ error: "Demo data already loaded" }, { status: 409 });
  }

  // 1. Find Jensen T5T protocol for assignment
  const [jensenProtocol] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.name, "Jensen T5T"))
    .limit(1);

  // 2. Insert Canon
  const [canon] = await db
    .insert(canons)
    .values({
      workspaceId,
      content: DEMO_CANON_CONTENT,
      rawInput: DEMO_CANON_RAW_INPUT,
      // Embedding left null for demo data (drift will use default 0.5)
    })
    .returning();

  // 3. Insert Captures + Artifacts (staggered timestamps for realistic drift trend)
  const now = Date.now();
  for (let i = 0; i < DEMO_CAPTURES.length; i++) {
    const demo = DEMO_CAPTURES[i];
    const captureTime = new Date(now - (DEMO_CAPTURES.length - i) * 24 * 60 * 60 * 1000);

    const [capture] = await db
      .insert(captures)
      .values({
        userId: session.user.id,
        workspaceId,
        content: demo.content,
        source: "web",
        processedAt: captureTime,
        createdAt: captureTime,
      })
      .returning();

    await db.insert(artifacts).values({
      captureId: capture.id,
      canonId: canon.id,
      driftScore: demo.driftScore,
      sentimentScore: demo.sentimentScore,
      content: demo.synthesis,
      actionItems: demo.actionItems,
      feedback: demo.feedback,
      createdAt: captureTime,
    });
  }

  // 4. Update membership gamification to show realistic values
  await db
    .update(memberships)
    .set({
      lastCaptureAt: new Date(),
      streakCount: 3,
      tractionScore: 0.65,
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membership.id));

  // 5. Assign protocol and mark as demo
  await db
    .update(workspaces)
    .set({
      isDemo: true,
      activeProtocolId: jensenProtocol?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));

  return NextResponse.json({
    success: true,
    message: "Demo data loaded",
    protocol: jensenProtocol ? { id: jensenProtocol.id, name: jensenProtocol.name } : null,
  });
}

// ── DELETE: Clear all workspace data ("Start Fresh") ────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  // Verify workspace exists and user is owner
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, session.user.id),
        eq(memberships.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!membership || membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can reset data" },
      { status: 403 }
    );
  }

  // 1. Delete artifacts for captures in this workspace
  const workspaceCaptures = await db
    .select({ id: captures.id })
    .from(captures)
    .where(eq(captures.workspaceId, workspaceId));

  if (workspaceCaptures.length > 0) {
    const captureIds = workspaceCaptures.map((c) => c.id);
    await db.delete(artifacts).where(inArray(artifacts.captureId, captureIds));
  }

  // 2. Delete captures
  await db.delete(captures).where(eq(captures.workspaceId, workspaceId));

  // 3. Delete canons
  await db.delete(canons).where(eq(canons.workspaceId, workspaceId));

  // 4. Reset memberships gamification
  await db
    .update(memberships)
    .set({
      lastCaptureAt: null,
      streakCount: 0,
      tractionScore: 0,
      updatedAt: new Date(),
    })
    .where(eq(memberships.workspaceId, workspaceId));

  // 5. Clear protocol and demo flag
  await db
    .update(workspaces)
    .set({
      isDemo: false,
      activeProtocolId: null,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));

  return NextResponse.json({ success: true, message: "Workspace reset complete" });
}
