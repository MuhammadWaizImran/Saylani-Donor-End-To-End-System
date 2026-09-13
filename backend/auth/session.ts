import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-jwt";

export function readSessionToken(req: Request): string | undefined {
  const cookie = req.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`));
  return cookie?.slice(SESSION_COOKIE.length + 1) || req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
}

export async function getSessionUser(req: Request) {
  const token = readSessionToken(req);
  return token ? verifySessionToken(token) : null;
}

export function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
