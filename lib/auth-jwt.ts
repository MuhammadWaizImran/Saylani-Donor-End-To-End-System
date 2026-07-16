import { SignJWT, jwtVerify } from "jose";
import type { Session } from "@/types/management";

const COOKIE_NAME = "smit_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error("AUTH_JWT_SECRET is not set in .env.local");
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { userId, name, email, role } = payload as Record<string, unknown>;
    if (
      typeof userId !== "string" ||
      typeof name !== "string" ||
      typeof email !== "string" ||
      (role !== "admin" && role !== "donor" && role !== "trainer")
    ) {
      return null;
    }
    return { userId, name, email, role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
