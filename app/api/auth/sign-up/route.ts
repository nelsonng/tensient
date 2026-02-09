import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users, organizations, workspaces, memberships } from "@/lib/db/schema";
import { nanoid } from "@/lib/utils";
import { checkSignupAllowed } from "@/lib/usage-guard";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export async function POST(request: Request) {
  try {
    // Platform capacity check
    const signupCheck = await checkSignupAllowed();
    if (!signupCheck.allowed) {
      return NextResponse.json(
        { error: signupCheck.reason },
        { status: 403 }
      );
    }

    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: `${firstName || email.split("@")[0]}'s Organization`,
      })
      .returning();

    // Create user (tier defaults to 'trial' via schema)
    const [user] = await db
      .insert(users)
      .values({
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        organizationId: org.id,
      })
      .returning();

    // Create default workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: "General",
        organizationId: org.id,
        joinCode: nanoid(8),
      })
      .returning();

    // Create membership as owner
    await db.insert(memberships).values({
      userId: user.id,
      workspaceId: workspace.id,
      role: "owner",
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      workspace: { id: workspace.id, name: workspace.name },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
