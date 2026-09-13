import { readSessionToken, sessionCookie } from "@/backend/auth/session";
import { revokeSessionToken } from "@/lib/auth-jwt";

export async function POST(req: Request) {
  const token = readSessionToken(req);
  // Makes the token itself unusable, not just the browser's copy of it — a
  // copy obtained some other way (e.g. an XSS-stolen Authorization header)
  // stops working the moment the real user logs out, instead of staying
  // valid for whatever's left of its 7-day life.
  if (token) await revokeSessionToken(token);

  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookie("", 0));
  return res;
}
