import { SignJWT, jwtVerify, decodeJwt } from "jose";
import { randomUUID } from "crypto";
import { mongo } from "@/lib/mongodb";
import type { Session } from "@/types/management";

const COOKIE_NAME = "smit_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const REVOKED_COLLECTION = "revoked_sessions";

function secretKey() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error("AUTH_JWT_SECRET is not set in .env.local");
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/** Has this token's jti been explicitly logged out? Checked on every
 *  verification so a revoked token stops working immediately, not just when
 *  its 7-day expiry eventually arrives. */
async function isRevoked(jti: string): Promise<boolean> {
  try {
    const db = await mongo();
    const doc = await db.collection(REVOKED_COLLECTION).findOne({ jti });
    return doc !== null;
  } catch {
    // The revocation store being unreachable already means every other
    // MongoDB-backed page is down too — fail open on availability rather
    // than locking every signed-in user out during a database blip.
    return false;
  }
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { userId, name, email, role, jti } = payload as Record<string, unknown>;
    if (
      typeof userId !== "string" ||
      typeof name !== "string" ||
      typeof email !== "string" ||
      (role !== "admin" && role !== "donor" && role !== "trainer")
    ) {
      return null;
    }
    if (typeof jti === "string" && (await isRevoked(jti))) return null;
    return { userId, name, email, role };
  } catch {
    return null;
  }
}

/**
 * Logout calls this with the token that's being signed out, so it stops
 * being valid immediately — even if it had already leaked — instead of
 * merely clearing the browser's cookie and leaving the token itself usable
 * via Authorization: Bearer until its 7-day expiry.
 */
export async function revokeSessionToken(token: string): Promise<void> {
  try {
    const payload = decodeJwt(token);
    if (typeof payload.jti !== "string" || typeof payload.exp !== "number") return;
    const db = await mongo();
    // expiresAt matches the token's own exp — the TTL index (see
    // scripts/ensure-indexes.ts) drops this row the moment the token would
    // have expired anyway, so the collection never grows unbounded.
    await db.collection(REVOKED_COLLECTION).insertOne({
      jti: payload.jti,
      expiresAt: new Date(payload.exp * 1000),
    });
  } catch {
    // Best-effort — the cookie is cleared either way, so the browser session
    // ends regardless of whether this write succeeded.
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
