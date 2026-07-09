import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase";

/**
 * Account creation (server-side, service role) — creates pre-confirmed
 * users so no SMTP is needed. Admin signups require the invite code
 * (ADMIN_SIGNUP_CODE) so random visitors can't grant themselves admin.
 */
const schema = z.object({
  name: z.string().min(3).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.enum(["donor", "admin"]),
  adminCode: z.string().optional(),
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
  const { name, email, password, role, adminCode } = parsed.data;

  if (role === "admin") {
    const expected = process.env.ADMIN_SIGNUP_CODE;
    if (!expected || adminCode !== expected) {
      return NextResponse.json(
        { error: "Invalid admin invite code. Ask an existing admin for the code." },
        { status: 403 },
      );
    }
  }

  const { error } = await supabaseServer().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (error) {
    const friendly = /already been registered/i.test(error.message)
      ? "An account with this email already exists — try logging in."
      : error.message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
