import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { firstName, lastName } = await request.json();

    // Validate inputs -- both are optional but must be strings if provided
    if (firstName !== undefined && typeof firstName !== "string") {
      return NextResponse.json(
        { error: "firstName must be a string" },
        { status: 400 }
      );
    }
    if (lastName !== undefined && typeof lastName !== "string") {
      return NextResponse.json(
        { error: "lastName must be a string" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (firstName !== undefined) updates.firstName = firstName.trim() || null;
    if (lastName !== undefined) updates.lastName = lastName.trim() || null;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      });

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("Failed to update profile", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
