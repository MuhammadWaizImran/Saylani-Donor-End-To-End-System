import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { UserRole } from "@/types/management";

/**
 * Server-side auth gate for the whole portal — the authoritative "refuse
 * before anything renders" boundary the client-side PortalShell check was
 * NOT (it only improves UX; it can't stop a request reaching the server).
 *
 * Runs before every matched route. It verifies the session JWT's signature
 * and expiry and checks the token's role against the path, so an
 * unauthenticated user — or a trainer poking at /portal/admin — is redirected
 * to login before a single row of data is fetched.
 *
 * Deliberately does NOT check the revocation list here (that needs MongoDB,
 * which isn't available in this pre-render hop). Revocation stays enforced by
 * getSessionUser() on the API routes and server pages that read real data —
 * this gate is the fast, universal first line, not the only one.
 */

const COOKIE_NAME = "smit_session";

/** Path prefix → the role it requires. Longest-prefix-wins via order. */
const ROLE_BY_PREFIX: Array<{ prefix: string; role: UserRole }> = [
  { prefix: "/portal/admin", role: "admin" },
  { prefix: "/portal/donor", role: "donor" },
  { prefix: "/portal/trainer", role: "trainer" },
];

function requiredRoleFor(pathname: string): UserRole | null {
  for (const { prefix, role } of ROLE_BY_PREFIX) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role;
  }
  return null; // shared portal routes (/portal, /portal/profile): any logged-in role
}

function secretKey() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error("AUTH_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/auth/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return redirectToLogin(req);

  let role: UserRole;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const r = payload.role;
    if (r !== "admin" && r !== "donor" && r !== "trainer") return redirectToLogin(req);
    role = r;
  } catch {
    // Bad signature, expired, or malformed → treat as unauthenticated.
    return redirectToLogin(req);
  }

  const needed = requiredRoleFor(req.nextUrl.pathname);
  if (needed !== null && needed !== role) {
    // Logged in, but wrong role for this section — send them to their own home.
    const url = req.nextUrl.clone();
    url.pathname = `/portal/${role}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Gate every portal route. API routes keep their own getSessionUser checks
  // (which also enforce revocation), so they're intentionally not matched here.
  matcher: ["/portal/:path*"],
};
