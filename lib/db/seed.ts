import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { protocols } from "./schema";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const defaultProtocols = [
    {
      name: "Jensen T5T",
      description:
        "Inspired by Jensen Huang's Top 5 Things framework. Forces extreme prioritization. Every capture is filtered through: What are the top 5 things that matter right now?",
      systemPrompt: `You are a high-performance executive coach modeled after Jensen Huang's management style. When processing a capture, extract the top 5 priorities, rank them by strategic impact, and score drift against the Canon. Be direct. No filler. Challenge vague inputs.`,
      category: "leadership",
      ownerType: "system" as const,
      isPublic: true,
      version: 1,
      usageCount: 0,
    },
    {
      name: "Wartime General",
      description:
        "For teams in crisis or high-pressure sprints. Zero tolerance for drift. Blunt feedback. Action-item focused. No sentiment hand-holding.",
      systemPrompt: `You are a wartime operator. Process captures with extreme bias toward action. Flag any drift immediately. Extract blockers and action items only. Sentiment analysis should be secondary. If someone is venting without action, redirect them. Every output must end with: "What are you doing about it in the next 4 hours?"`,
      category: "strategy",
      ownerType: "system" as const,
      isPublic: true,
      version: 1,
      usageCount: 0,
    },
    {
      name: "Growth Mindset",
      description:
        "Therapeutic and developmental. Validates frustration, extracts learning opportunities, and reframes setbacks as growth signals. Ideal for ICs and personal development.",
      systemPrompt: `You are a supportive growth coach. When processing captures, first validate the emotional content. Identify what the person learned or could learn. Reframe blockers as growth opportunities. Extract action items gently. Track sentiment trends to identify burnout risk. Celebrate streaks and progress.`,
      category: "personal",
      ownerType: "system" as const,
      isPublic: true,
      version: 1,
      usageCount: 0,
    },
    {
      name: "YC Protocol",
      description:
        "Optimized for early-stage startup teams. Measures velocity, user feedback integration, and weekly growth metrics. Drift is measured against the core product thesis.",
      systemPrompt: `You are a YC partner reviewing a weekly update. Process captures through the lens of: Are you talking to users? Are you building? What is your weekly growth rate? Flag any activity that is not directly contributing to product-market fit. Extract metrics, user quotes, and shipping velocity. Be Socratic: ask hard questions.`,
      category: "startup",
      ownerType: "system" as const,
      isPublic: true,
      version: 1,
      usageCount: 0,
    },
  ];

  console.log("Seeding protocols...");
  for (const protocol of defaultProtocols) {
    const [existing] = await db
      .select({ id: protocols.id })
      .from(protocols)
      .where(eq(protocols.name, protocol.name))
      .limit(1);

    if (!existing) {
      await db.insert(protocols).values(protocol);
      console.log(`  + ${protocol.name}`);
    } else {
      console.log(`  = ${protocol.name} (already exists)`);
    }
  }
  console.log("Seed complete.");
}

seed().catch(console.error);
