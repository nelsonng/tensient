import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Server-side guard that ensures the current user is a super admin.
 * Redirects to /dashboard if not authenticated or not a super admin.
 * Returns the session for use in admin server components.
 */
export async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  if (!session.user.isSuperAdmin) {
    redirect("/dashboard");
  }

  return session;
}

/**
 * API route guard for super admin endpoints.
 * Returns the session if authorized, or null if not.
 */
export async function requireSuperAdminAPI() {
  const session = await auth();

  if (!session?.user?.id || !session.user.isSuperAdmin) {
    return null;
  }

  return session;
}
