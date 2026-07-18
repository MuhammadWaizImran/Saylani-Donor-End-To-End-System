import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revokeSessionToken, SESSION_COOKIE } from "@/lib/auth-jwt";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  // Makes the token itself unusable, not just the browser's copy of it — a
  // copy obtained some other way (e.g. an XSS-stolen Authorization header)
  // stops working the moment the real user logs out, instead of staying
  // valid for whatever's left of its 7-day life.
  if (token) await revokeSessionToken(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
