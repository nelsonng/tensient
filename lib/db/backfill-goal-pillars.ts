/**
 * Backfill goalPillar on existing artifacts and actions using embedding similarity.
 *
 * Run: DATABASE_URL="..." GEMINI_API_KEY="..." npx tsx lib/db/backfill-goal-pillars.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, isNull } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { canons, artifacts, actions, workspaces } from "./schema";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 1536 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function backfillGoalPillars() {
  console.log("Backfilling goal pillars...\n");

  // Find the demo workspace
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, "Tensient Health Product & Engineering"))
    .limit(1);

  if (!workspace) {
    console.log("Demo workspace not found, exiting.");
    return;
  }

  console.log(`Workspace: ${workspace.id}`);

  // Get the latest canon with healthAnalysis
  const [canon] = await db
    .select({
      id: canons.id,
      healthAnalysis: canons.healthAnalysis,
    })
    .from(canons)
    .where(eq(canons.workspaceId, workspace.id))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  if (!canon?.healthAnalysis) {
    console.log("No canon with healthAnalysis found, exiting.");
    return;
  }

  const pillars = (
    (canon.healthAnalysis as Record<string, unknown>).pillars as Array<{
      title: string;
    }>
  ).map((p) => p.title);

  console.log(`Found ${pillars.length} pillars:`);
  pillars.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

  // Generate embeddings for each pillar title
  console.log("\nGenerating pillar embeddings...");
  const pillarEmbeddings: Array<{ title: string; embedding: number[] }> = [];
  for (const title of pillars) {
    const embedding = await generateEmbedding(title);
    pillarEmbeddings.push({ title, embedding });
    console.log(`  Embedded: ${title}`);
  }

  // Backfill artifacts
  console.log("\nBackfilling artifacts...");
  const allArtifacts = await db
    .select({
      id: artifacts.id,
      embedding: artifacts.embedding,
      content: artifacts.content,
    })
    .from(artifacts)
    .where(isNull(artifacts.goalPillar));

  let artifactCount = 0;
  for (const artifact of allArtifacts) {
    if (!artifact.embedding) continue;

    const artEmb = artifact.embedding as number[];
    let bestPillar: string | null = null;
    let bestScore = 0.3; // minimum threshold

    for (const pe of pillarEmbeddings) {
      const score = cosineSimilarity(artEmb, pe.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestPillar = pe.title;
      }
    }

    if (bestPillar) {
      await db
        .update(artifacts)
        .set({ goalPillar: bestPillar })
        .where(eq(artifacts.id, artifact.id));
      artifactCount++;
    }
  }
  console.log(`  Updated ${artifactCount}/${allArtifacts.length} artifacts`);

  // Backfill actions -- use the action title to generate an embedding
  console.log("\nBackfilling actions...");
  const allActions = await db
    .select({
      id: actions.id,
      title: actions.title,
    })
    .from(actions)
    .where(isNull(actions.goalPillar));

  let actionCount = 0;
  for (const action of allActions) {
    try {
      const actionEmb = await generateEmbedding(action.title);
      let bestPillar: string | null = null;
      let bestScore = 0.3;

      for (const pe of pillarEmbeddings) {
        const score = cosineSimilarity(actionEmb, pe.embedding);
        if (score > bestScore) {
          bestScore = score;
          bestPillar = pe.title;
        }
      }

      if (bestPillar) {
        await db
          .update(actions)
          .set({ goalPillar: bestPillar })
          .where(eq(actions.id, action.id));
        actionCount++;
      }
    } catch {
      // Skip if embedding fails for an action
    }
  }
  console.log(`  Updated ${actionCount}/${allActions.length} actions`);

  console.log("\nDone!");
}

backfillGoalPillars().catch(console.error);
