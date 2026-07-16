import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session, UserRole } from "@/types/management";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-jwt";

/**
 * Server-side session helpers. Sessions are signed JWTs issued by
 * /api/auth/login and stored in an httpOnly cookie — no client-supplied
 * roles are ever trusted.
 */

async function userFromCookies(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

async function userFromBearer(req?: Request): Promise<Session | null> {
  const header = req?.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifySessionToken(header.slice(7));
}

/** Verified session for the current request (cookie or Bearer token). */
export async function getSessionUser(req?: Request): Promise<Session | null> {
  return (await userFromCookies()) ?? (await userFromBearer(req));
}

/** Page guard for server components: redirects when not signed in / wrong role. */
export async function requireRole(roles: UserRole[]): Promise<Session> {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  if (!roles.includes(session.role)) redirect("/portal");
  return session;
}
