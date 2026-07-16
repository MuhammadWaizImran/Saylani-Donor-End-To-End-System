import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { mongo } from "@/lib/mongodb";

/**
 * Donor account creation only. Admin/trainer accounts are the company's
 * real MongoDB records (`users` / `trainers`) and are managed by them, not
 * self-served here. Donor accounts have no real-data equivalent, so they
 * live in our own `portal_donors` collection.
 */
const schema = z.object({
  name: z.string().min(3).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.literal("donor"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 422 },
    );
  }
  const { name, email, password } = parsed.data;

  const db = await mongo();
  const donors = db.collection("portal_donors");
  const existing = await donors.findOne({ email: { $regex: `^${email}$`, $options: "i" } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists — try logging in." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await donors.insertOne({ name, email, password: passwordHash, createdAt: new Date() });

  return NextResponse.json({ success: true });
}
