import { createClient } from "@supabase/supabase-js";

const BASE = "https://saylani-donor-portal.vercel.app";
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await anon.auth.signInWithPassword({ email: "admin@saylani.org", password: "admin123" });
  if (error || !data.session) throw new Error("local supabase login failed: " + error?.message);
  const auth = { Authorization: `Bearer ${data.session.access_token}` };

  const recordsRes = await fetch(`${BASE}/api/admin/records`, { headers: auth });
  console.log(`GET /api/admin/records -> ${recordsRes.status}`);
  if (recordsRes.ok) {
    const body = await recordsRes.json();
    console.log("  campuses returned:", body.campuses?.length ?? 0);
  } else {
    console.log("  body:", (await recordsRes.text()).slice(0, 200));
  }

  const chatRes = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ messages: [{ role: "user", content: "How many campuses do we have? One line." }] }),
  });
  const chatBody = await chatRes.json();
  console.log(`POST /api/chat -> ${chatRes.status}, mode: ${chatBody.mode}`);
  console.log("  reply:", chatBody.content?.slice(0, 150));
}
main().catch((e) => console.error("FAILED:", e.message));
