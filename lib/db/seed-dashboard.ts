/**
 * Seed dashboard data: Goal Clarity coach, weekly digest, goal health analysis.
 *
 * Run: DATABASE_URL="..." npx tsx lib/db/seed-dashboard.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import { protocols, canons, digests, workspaces } from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seedDashboard() {
  console.log("Seeding dashboard data...\n");

  // ── 1. Goal Clarity Coach ──────────────────────────────────────────────

  const existingClarity = await db
    .select({ id: protocols.id })
    .from(protocols)
    .where(eq(protocols.name, "Goal Clarity"))
    .limit(1);

  if (existingClarity.length === 0) {
    await db.insert(protocols).values({
      name: "Goal Clarity",
      description:
        "Evaluates strategic goals against SMART criteria and leadership frameworks. Identifies vague language, missing metrics, and untimed commitments. Helps organizations sharpen their direction.",
      systemPrompt: `You are an expert in strategic goal-setting and organizational alignment. Evaluate goals against the SMART framework (Specific, Measurable, Achievable, Relevant, Time-bound) and OKR best practices.

When analyzing goals:
1. Break the strategy into distinct pillars/objectives
2. Score each pillar against SMART criteria (true/false for each)
3. Identify vague language that could be made more specific
4. Flag missing metrics or success criteria
5. Note any objectives without clear timelines
6. Suggest concrete improvements

Frame feedback constructively -- the goal is to help organizations sharpen their direction, not to criticize. Use language like "This could be stronger with..." rather than "This is wrong."

Output structured JSON with overallScore (0-1), pillars array with per-pillar SMART breakdown, and 2-3 actionable suggestions.`,
      category: "strategy",
      ownerType: "system",
      isPublic: true,
      version: 1,
      usageCount: 0,
      schemaDef: {
        exampleInput:
          "Review our Q1 goals and tell us how to make them more actionable.",
      },
    });
    console.log("  Created Goal Clarity coach");
  } else {
    console.log("  Goal Clarity coach already exists");
  }

  // ── 2. Goal Health Analysis ────────────────────────────────────────────

  // Find the demo workspace by name (not just any workspace)
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, "Tensient Health Product & Engineering"))
    .limit(1);

  if (!workspace) {
    console.log("  Demo workspace 'Tensient Health Product & Engineering' not found, skipping");
    return;
  }

  console.log(`  Found demo workspace: ${workspace.id}`);

  // ── Cleanup: remove old data so we can reseed cleanly ────────────────
  await db.delete(digests).where(eq(digests.workspaceId, workspace.id));
  console.log("  Cleaned up old digests");

  // Find the latest canon
  const [canon] = await db
    .select({ id: canons.id, content: canons.content })
    .from(canons)
    .where(eq(canons.workspaceId, workspace.id))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  if (canon) {
    const healthAnalysis = {
      overallScore: 0.68,
      pillars: [
        {
          title: "Dominate top 20 health systems by region",
          smart: {
            specific: true,
            measurable: true,
            achievable: true,
            relevant: true,
            timeBound: false,
          },
          score: 0.8,
          suggestion:
            "Add a target date -- by when should you have named account coverage in all 20?",
        },
        {
          title: "Deliver hard ROI data for expansion",
          smart: {
            specific: true,
            measurable: true,
            achievable: true,
            relevant: true,
            timeBound: true,
          },
          score: 0.9,
          suggestion:
            "Strong goal. Consider defining a specific FTE-hours target per client.",
        },
        {
          title: "Ship next-gen staffing intelligence",
          smart: {
            specific: false,
            measurable: false,
            achievable: true,
            relevant: true,
            timeBound: false,
          },
          score: 0.5,
          suggestion:
            "\"Next-generation\" is vague. Define the specific capability milestone (e.g., intent-based scheduling live at 3 sites by Q3).",
        },
        {
          title: "Launch compliance automation as 2nd product line",
          smart: {
            specific: true,
            measurable: false,
            achievable: true,
            relevant: true,
            timeBound: false,
          },
          score: 0.6,
          suggestion:
            "Good strategic direction. Add launch date and first-customer target to make it measurable.",
        },
        {
          title: "Build leadership culture that scales",
          smart: {
            specific: false,
            measurable: false,
            achievable: true,
            relevant: true,
            timeBound: false,
          },
          score: 0.4,
          suggestion:
            "Culture goals need observable indicators. Define 2-3 specific behaviors you'd measure in a pulse survey.",
        },
      ],
    };

    await db
      .update(canons)
      .set({
        healthScore: healthAnalysis.overallScore,
        healthAnalysis,
      })
      .where(eq(canons.id, canon.id));

    console.log(
      `  Updated goal health: ${healthAnalysis.overallScore * 100}% SMART score`
    );
  }

  // ── 3. Weekly Digest (Top 5 Things) ────────────────────────────────────

  // Calculate this week's Monday
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  // Insert fresh digest (cleanup already ran above)
  await db.insert(digests).values({
    workspaceId: workspace.id,
    weekStart,
    summary:
      "SOC2 compliance is the highest-leverage item this week -- encryption migration is done and the gap assessment is imminent. The Adventist Health pilot is generating real usage data but needs monitoring for adoption blockers. Compliance automation is gaining strategic momentum post-board approval. Two open roles remain critical bottlenecks.",
    items: [
      {
        rank: 1,
        title: "SOC2 Compliance Sprint at Critical Milestone",
        detail:
          "AES-256 encryption migration complete in staging. Gap assessment starts in 2 weeks. Incident response plan drafted. This unlocks enterprise pipeline.",
        coachAttribution: "Jensen T5T",
        goalPillar: "Dominate top 20 health systems",
        priority: "critical",
      },
      {
        rank: 2,
        title: "Adventist Health Pilot Generating Real Data",
        detail:
          "Credential verification live with first nurse cohort. Early metrics show 40% reduction in manual verification time. Adoption needs monitoring -- 7 yellow accounts flagged.",
        coachAttribution: "YC Protocol",
        goalPillar: "Deliver hard ROI data",
        priority: "critical",
      },
      {
        rank: 3,
        title: "Compliance Automation Greenlit by Board",
        detail:
          "Board approved second product line. Product brief written, customer discovery calls scheduled with Rachel. Finance beachhead strategy validated. Need to move from strategy to shipping.",
        coachAttribution: "Wartime General",
        goalPillar: "Compliance automation",
        priority: "high",
      },
      {
        rank: 4,
        title: "Engineering Capacity Stretched -- 2 Roles Still Open",
        detail:
          "DevOps lead hired but Senior SRE and Frontend still open. FHIR adapter timeline slipping without dedicated resource. Marcus is single-threaded on too many critical paths.",
        coachAttribution: "Growth Mindset",
        goalPillar: "Staffing intelligence",
        priority: "high",
      },
      {
        rank: 5,
        title: "Scheduling Engine Pushed to Q2 for Stability",
        detail:
          "Strategic decision to delay scheduling engine launch to ensure Adventist pilot stability. 3 customer discovery calls completed for requirements validation. Intent-based approach validated but needs more data.",
        coachAttribution: "Jensen T5T",
        goalPillar: "Staffing intelligence",
        priority: "medium",
      },
    ],
  });
  console.log("  Created weekly Top 5 digest");

  console.log("\nDone!");
}

seedDashboard().catch(console.error);
