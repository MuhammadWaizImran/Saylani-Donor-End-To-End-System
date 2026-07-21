import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { mongo } from "@/lib/mongodb";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth-jwt";
import type { Session, UserRole } from "@/types/management";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["admin", "donor", "trainer"]),
});

/**
 * Real-data auth: admin logins check the company's `users` collection,
 * trainer logins check `trainers` (trainers have their own email/password,
 * separate from `users`). Donor accounts have no real-data equivalent, so
 * they live in our own `portal_donors` collection instead.
 */
/** Case-insensitive collation, not a $regex scan — matches the collation
 *  index ensured by scripts/ensure-indexes.ts on each collection's `email`
 *  field, so this stays a real index lookup as the collections grow. */
const EMAIL_COLLATION = { locale: "en", strength: 2 } as const;
const ADMIN_ROLES = new Set(["admin", "ADMIN", "super_admin", "SUPER_ADMIN"]);

async function findAccount(
  role: UserRole,
  email: string,
): Promise<{ session: Session; passwordHash: string } | null> {
  const db = await mongo();
  const emailFilter = { email };
  const opts = { collation: EMAIL_COLLATION };

  if (role === "admin") {
    const doc = await db.collection("users").findOne(emailFilter, opts);
    // The portal's admin tab must not turn receptionist/campus-manager
    // accounts into full administrators merely because they live in users.
    if (!doc?.password || !ADMIN_ROLES.has(String(doc.role ?? "")) || String(doc.status ?? "active").toLowerCase() !== "active") {
      return null;
    }
    return {
      session: { userId: String(doc._id), name: doc.name ?? doc.email, email: doc.email, role: "admin" },
      passwordHash: doc.password,
    };
  }

  if (role === "trainer") {
    const doc = await db.collection("trainers").findOne(emailFilter, opts);
    if (!doc?.password) return null;
    return {
      session: {
        userId: String(doc._id),
        name: doc.en?.trainer_name ?? doc.email,
        email: doc.email,
        role: "trainer",
      },
      passwordHash: doc.password,
    };
  }

  const doc = await db.collection("portal_donors").findOne(emailFilter, opts);
  if (!doc?.password) return null;
  return {
    session: { userId: String(doc._id), name: doc.name ?? doc.email, email: doc.email, role: "donor" },
    passwordHash: doc.password,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 422 });
  }
  const { email, password, role } = parsed.data;

  const account = await findAccount(role, email);
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await signSession(account.session);
  const res = NextResponse.json({ session: account.session, token });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
