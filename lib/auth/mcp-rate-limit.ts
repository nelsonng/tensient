import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function isApiKeyRateLimited(
  apiKeyId: string,
  maxCallsPerMinute: number
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM platform_events
    WHERE type = 'mcp_tool_called'
      AND metadata->>'apiKeyId' = ${apiKeyId}
      AND created_at > NOW() - INTERVAL '60 seconds'
  `);

  const count = Number(result.rows[0]?.count ?? 0);
  return count >= maxCallsPerMinute;
}
