/**
 * Fix traction scores for seeded data.
 *
 * The seed script backdated captures/artifacts but processCapture
 * uses new Date() for streak calculations. This script replays
 * the rolling average using the actual backdated timestamps.
 *
 * Run: DATABASE_URL="..." npx tsx lib/db/fix-traction-scores.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, asc } from "drizzle-orm";

// Self-contained -- avoid @/ path aliases for tsx compatibility
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Inline table references to avoid path alias issues
import {
  memberships,
  captures,
  artifacts,
} from "./schema";

async function fixTractionScores() {
  console.log("Fixing traction scores for seeded data...\n");

  // Get all memberships
  const allMemberships = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      workspaceId: memberships.workspaceId,
    })
    .from(memberships);

  console.log(`Found ${allMemberships.length} memberships\n`);

  for (const membership of allMemberships) {
    // Get all artifacts for this user in this workspace, ordered chronologically
    const userArtifacts = await db
      .select({
        driftScore: artifacts.driftScore,
        captureCreatedAt: captures.createdAt,
      })
      .from(artifacts)
      .innerJoin(captures, eq(artifacts.captureId, captures.id))
      .where(eq(captures.userId, membership.userId))
      .orderBy(asc(captures.createdAt));

    // Filter to this workspace
    const workspaceArtifacts = await db
      .select({
        driftScore: artifacts.driftScore,
        captureCreatedAt: captures.createdAt,
      })
      .from(artifacts)
      .innerJoin(captures, eq(artifacts.captureId, captures.id))
      .where(eq(captures.userId, membership.userId))
      .orderBy(asc(captures.createdAt));

    if (workspaceArtifacts.length === 0) {
      console.log(`  [${membership.userId.slice(0, 8)}] No artifacts, skipping`);
      continue;
    }

    // Replay the rolling average
    let tractionScore = 0;
    let streakCount = 0;
    let lastCaptureAt: Date | null = null;

    for (const artifact of workspaceArtifacts) {
      const alignmentScore = Math.round((1 - (artifact.driftScore ?? 0.5)) * 100) / 100;
      const captureTime = artifact.captureCreatedAt;

      // Streak calculation using backdated timestamps
      if (lastCaptureAt) {
        const hoursElapsed =
          (captureTime.getTime() - lastCaptureAt.getTime()) / (1000 * 60 * 60);
        streakCount = hoursElapsed <= 168 ? streakCount + 1 : 1; // 7 days for weekly cadence
      } else {
        streakCount = 1;
      }

      // Rolling average: 70% old + 30% new
      tractionScore =
        tractionScore === 0
          ? alignmentScore
          : tractionScore * 0.7 + alignmentScore * 0.3;
      tractionScore = Math.round(tractionScore * 100) / 100;

      lastCaptureAt = captureTime;
    }

    // Update the membership
    await db
      .update(memberships)
      .set({
        tractionScore,
        streakCount,
        lastCaptureAt,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, membership.id));

    console.log(
      `  [${membership.userId.slice(0, 8)}] ${workspaceArtifacts.length} artifacts -> ` +
      `traction: ${Math.round(tractionScore * 100)}%, streak: ${streakCount}`
    );
  }

  console.log("\nDone! Traction scores updated.");
}

fixTractionScores().catch(console.error);
