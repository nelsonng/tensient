import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { users, platformEvents } from "@/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Lightweight event tracker for auth context (can't import lib/platform-events
// because auth.ts uses its own db instance for Edge compatibility)
function trackAuthEvent(type: string, metadata: Record<string, unknown>) {
  db.insert(platformEvents)
    .values({
      type: type as "sign_in_success" | "sign_in_failed",
      userId: (metadata.userId as string) || null,
      metadata,
    })
    .catch(() => {
      // Non-critical -- don't break auth flow
    });
}

/** Extract IP/geo from Vercel request headers (same logic as lib/request-geo.ts
 *  but inlined here to avoid importing from lib/ in Edge-compatible auth.ts) */
async function getAuthGeo() {
  try {
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      city: h.get("x-vercel-ip-city") || null,
      region: h.get("x-vercel-ip-country-region") || null,
      country: h.get("x-vercel-ip-country") || null,
    };
  } catch {
    return { ip: null, city: null, region: null, country: null };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;
        const geo = await getAuthGeo();

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.passwordHash) {
          trackAuthEvent("sign_in_failed", { email, reason: "user_not_found", ...geo });
          return null;
        }

        const valid = await compare(password, user.passwordHash);
        if (!valid) {
          trackAuthEvent("sign_in_failed", { email, reason: "invalid_password", userId: user.id, ...geo });
          return null;
        }

        trackAuthEvent("sign_in_success", { userId: user.id, email, ...geo });

        return {
          id: user.id,
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
          emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
          isSuperAdmin: user.isSuperAdmin ?? false,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.emailVerified = (user as Record<string, unknown>).emailVerified as string | null;
        token.isSuperAdmin = (user as Record<string, unknown>).isSuperAdmin as boolean;
      } else if (token.id && !token.emailVerified) {
        // Re-check DB for users who haven't verified yet --
        // once verified, the token caches the value and this stops querying
        const [row] = await db
          .select({ emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        if (row?.emailVerified) {
          token.emailVerified = row.emailVerified.toISOString();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.emailVerified = token.emailVerified ? new Date(token.emailVerified as string) : null;
        session.user.isSuperAdmin = (token.isSuperAdmin as boolean) ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
