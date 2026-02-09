import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Verifies that a user is a member of the given workspace.
 * Returns the membership record if found, null otherwise.
 */
export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
) {
  const [membership] = await db
    .select({
      id: memberships.id,
      role: memberships.role,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.workspaceId, workspaceId)
      )
    )
    .limit(1);

  return membership ?? null;
}
