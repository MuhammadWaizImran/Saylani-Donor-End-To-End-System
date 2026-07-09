import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { Session, UserRole } from "@/types/management";
import { supabaseServer } from "@/lib/supabase";

/**
 * Server-side session helpers. The browser client stores the Supabase
 * session in cookies, so server components and API routes can verify who
 * is signed in — no client-supplied roles are ever trusted.
 */

function toSession(user: User | null): Session | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as { name?: string; role?: string };
  const role = meta.role;
  if (role !== "admin" && role !== "donor" && role !== "trainer") return null;
  return {
    userId: user.id,
    name: meta.name ?? user.email ?? "User",
    email: user.email ?? "",
    role,
  };
}

async function userFromCookies(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {
            /* read-only in server components/route handlers */
          },
        },
      },
    );
    const { data } = await client.auth.getUser();
    return toSession(data.user);
  } catch {
    return null;
  }
}

async function userFromBearer(req?: Request): Promise<Session | null> {
  const header = req?.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const { data } = await supabaseServer().auth.getUser(header.slice(7));
    return toSession(data.user);
  } catch {
    return null;
  }
}

/** Verified session for the current request (cookie or Bearer token). */
export async function getSessionUser(req?: Request): Promise<Session | null> {
  return (await userFromCookies()) ?? (await userFromBearer(req));
}

/** Page guard for server components: redirects when not signed in / wrong role. */
export async function requireRole(roles: UserRole[]): Promise<Session> {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  if (!roles.includes(session.role)) redirect("/portal");
  return session;
}
