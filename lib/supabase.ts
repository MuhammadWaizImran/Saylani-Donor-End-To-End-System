import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase clients.
 *
 * - `supabaseServer()` — SERVICE-ROLE client for server code (API routes,
 *   server components). Bypasses RLS; never import in client components.
 * - `supabaseAnon()` — public client, safe for the browser; only sees what
 *   RLS policies allow (read-only public content).
 */

let serverClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (!serverClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
      );
    }
    serverClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serverClient;
}

export function supabaseAnon(): SupabaseClient {
  if (!anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
      );
    }
    anonClient = createClient(url, key);
  }
  return anonClient;
}

/** True when Supabase env vars are present — lets the data layer fall back
 *  to mock data until the database is configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
