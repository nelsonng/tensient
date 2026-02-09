/**
 * Migrate existing JSONB action items from artifacts into the new actions table.
 * Also assigns goal linkage and priorities based on the action content.
 *
 * Run: DATABASE_URL="..." npx tsx lib/db/migrate-actions.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, isNotNull } from "drizzle-orm";
import {
  artifacts,
  captures,
  canons,
  actions,
} from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

interface ActionItemJson {
  task: string;
  status: string;
  coach_attribution?: string;
}

// Varied priorities based on keywords
function inferPriority(task: string): "critical" | "high" | "medium" | "low" {
  const lower = task.toLowerCase();
  if (
    lower.includes("immediately") ||
    lower.includes("urgent") ||
    lower.includes("critical") ||
    lower.includes("block") ||
    lower.includes("churn") ||
    lower.includes("risk")
  )
    return "critical";
  if (
    lower.includes("prioritize") ||
    lower.includes("schedule") ||
    lower.includes("review") ||
    lower.includes("finalize") ||
    lower.includes("deploy")
  )
    return "high";
  if (
    lower.includes("consider") ||
    lower.includes("explore") ||
    lower.includes("document") ||
    lower.includes("research")
  )
    return "low";
  return "medium";
}

// Varied statuses for demo believability
function mapStatus(
  status: string,
  task: string,
  dateStr: Date
): "open" | "in_progress" | "blocked" | "done" | "wont_do" {
  // Anything the AI marked as "done" stays done
  if (status === "done") return "done";
  if (status === "blocked") return "blocked";

  // For older actions, randomly mark some as done/in_progress for realism
  const ageInDays = (Date.now() - dateStr.getTime()) / (1000 * 60 * 60 * 24);
  const hash = task.length + task.charCodeAt(0);

  if (ageInDays > 21) {
    // Older items: 40% done, 15% wont_do, 20% in_progress, 25% open
    const r = hash % 100;
    if (r < 40) return "done";
    if (r < 55) return "wont_do";
    if (r < 75) return "in_progress";
    return "open";
  }
  if (ageInDays > 7) {
    // Mid-age: 25% done, 30% in_progress, 45% open
    const r = hash % 100;
    if (r < 25) return "done";
    if (r < 55) return "in_progress";
    return "open";
  }
  // Recent: mostly open
  return hash % 3 === 0 ? "in_progress" : "open";
}

// Coach attribution for demo
const COACH_NAMES = [
  "Jensen T5T",
  "Wartime General",
  "Growth Mindset",
  "YC Protocol",
];

function assignCoach(task: string): string {
  const lower = task.toLowerCase();
  if (
    lower.includes("prioritize") ||
    lower.includes("top") ||
    lower.includes("focus")
  )
    return "Jensen T5T";
  if (
    lower.includes("immediately") ||
    lower.includes("urgent") ||
    lower.includes("escalate") ||
    lower.includes("block")
  )
    return "Wartime General";
  if (
    lower.includes("learn") ||
    lower.includes("growth") ||
    lower.includes("develop") ||
    lower.includes("feedback")
  )
    return "Growth Mindset";
  // Default: rotate based on task length
  return COACH_NAMES[task.length % COACH_NAMES.length];
}

async function migrateActions() {
  console.log("Migrating JSONB action items to actions table...\n");

  // Check if any actions already exist
  const existing = await db
    .select({ id: actions.id })
    .from(actions)
    .limit(1);

  if (existing.length > 0) {
    console.log("Actions table already has data. Skipping migration.");
    return;
  }

  // Get all artifacts with action items
  const artifactRows = await db
    .select({
      artifactId: artifacts.id,
      actionItems: artifacts.actionItems,
      createdAt: artifacts.createdAt,
      userId: captures.userId,
      workspaceId: captures.workspaceId,
    })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .where(isNotNull(artifacts.actionItems))
    .orderBy(desc(artifacts.createdAt));

  // Get latest canon per workspace for goal linkage
  const canonMap = new Map<string, string>();
  const workspaceIds = [...new Set(artifactRows.map((a) => a.workspaceId))];

  for (const wsId of workspaceIds) {
    const [canon] = await db
      .select({ id: canons.id })
      .from(canons)
      .where(eq(canons.workspaceId, wsId))
      .orderBy(desc(canons.createdAt))
      .limit(1);
    if (canon) canonMap.set(wsId, canon.id);
  }

  let totalActions = 0;
  let linkedCount = 0;

  for (const row of artifactRows) {
    const items = row.actionItems as ActionItemJson[];
    if (!Array.isArray(items) || items.length === 0) continue;

    const goalId = canonMap.get(row.workspaceId) || null;

    for (const item of items) {
      if (!item.task) continue;

      const status = mapStatus(item.status, item.task, row.createdAt);
      const priority = inferPriority(item.task);
      const coach = item.coach_attribution || assignCoach(item.task);

      // Goal alignment: use a heuristic score for migration (real scoring would use embeddings)
      // Assign ~70% of actions to the goal for demo purposes
      const hash = item.task.length + item.task.charCodeAt(0);
      const shouldLink = hash % 10 < 7;
      const alignmentScore = shouldLink
        ? 0.4 + (hash % 50) / 100 // 0.40 - 0.89
        : 0.1 + (hash % 20) / 100; // 0.10 - 0.29

      await db.insert(actions).values({
        workspaceId: row.workspaceId,
        userId: row.userId,
        artifactId: row.artifactId,
        goalId: shouldLink ? goalId : null,
        title: item.task,
        status,
        priority,
        goalAlignmentScore: Math.round(alignmentScore * 100) / 100,
        coachAttribution: coach,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      });

      totalActions++;
      if (shouldLink && goalId) linkedCount++;
    }
  }

  console.log(`Migrated ${totalActions} actions from ${artifactRows.length} artifacts`);
  console.log(`${linkedCount} linked to goals, ${totalActions - linkedCount} unlinked`);
  console.log("\nDone!");
}

migrateActions().catch(console.error);
