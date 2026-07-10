import { NextResponse } from "next/server";

/** Temporary diagnostic route — reports env var PRESENCE (never values) to
 *  debug a production auth issue. Delete once the issue is resolved. */
export async function GET() {
  const check = (v: string | undefined) => (v ? `present (len=${v.length})` : "MISSING");
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: check(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: check(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: check(process.env.SUPABASE_SERVICE_ROLE_KEY),
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
