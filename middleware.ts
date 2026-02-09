import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight edge-compatible middleware.
 * Checks for the NextAuth session token cookie instead of importing
 * the full auth config (which pulls in bcryptjs / Node.js modules).
 */
export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!token) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
