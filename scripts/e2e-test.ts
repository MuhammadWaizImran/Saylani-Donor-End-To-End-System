/**
 * End-to-end system test against the running dev server.
 *
 *   npm run e2e   (dev server must be running on :3000)
 *
 * Covers: public pages, auth login, role-based API access (positive AND
 * negative), chat agent, admin records API, TTS fallback.
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function token(email: string, password: string): Promise<string> {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function main() {
  console.log("— Public pages —");
  for (const path of ["/", "/campaigns", "/donate", "/contact", "/auth/login", "/auth/signup", "/nope-404"]) {
    const res = await fetch(`${BASE}${path}`);
    const want = path === "/nope-404" ? 404 : 200;
    check(`GET ${path} → ${want}`, res.status === want, `got ${res.status}`);
  }

  console.log("— Auth —");
  const adminToken = await token("admin@saylani.org", "admin123");
  const trainerToken = await token("kashif.mehmood@saylani.org", "trainer123");
  const donorToken = await token("donor@saylani.org", "donor123");
  check("all three demo accounts log in", true);

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  console.log("— RBAC: negative cases —");
  let res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  check("chat without session → 401", res.status === 401, `got ${res.status}`);

  res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(donorToken) },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  check("chat as donor → 403", res.status === 403, `got ${res.status}`);

  res = await fetch(`${BASE}/api/admin/records`, { headers: auth(trainerToken) });
  check("admin records as trainer → 4xx", res.status === 401 || res.status === 403, `got ${res.status}`);

  res = await fetch(`${BASE}/api/portal/trainer`, { headers: auth(adminToken) });
  check("trainer dashboard as admin → 403", res.status === 403, `got ${res.status}`);

  res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Evil Admin", email: "evil@x.com", password: "hack123", role: "admin", adminCode: "wrong" }),
  });
  check("admin signup with wrong code → 403", res.status === 403, `got ${res.status}`);

  console.log("— RBAC: positive cases —");
  res = await fetch(`${BASE}/api/portal/trainer`, { headers: auth(trainerToken) });
  const trainerData = res.ok ? await res.json() : null;
  check(
    "trainer dashboard loads own data",
    res.status === 200 && trainerData?.trainer?.name === "Kashif Mehmood",
    `got ${res.status} / ${trainerData?.trainer?.name}`,
  );

  res = await fetch(`${BASE}/api/admin/records`, { headers: auth(adminToken) });
  const records = res.ok ? await res.json() : null;
  check(
    "admin records dropdowns load",
    res.status === 200 && Array.isArray(records?.campuses) && records.campuses.length > 0,
    `got ${res.status}`,
  );

  console.log("— AI agent (live) —");
  res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(adminToken) },
    body: JSON.stringify({ messages: [{ role: "user", content: "How many campuses do we have? One line." }] }),
  });
  const chat = res.ok ? await res.json() : null;
  check(
    `chat agent answers (mode=${chat?.mode})`,
    res.status === 200 && typeof chat?.content === "string" && chat.content.length > 0,
    `got ${res.status}`,
  );
  check("chat used live AI (not mock fallback)", chat?.mode === "live", `mode=${chat?.mode}`);
  check(
    "answer states campus count (6 base / 206 with load data)",
    /\b(6|six|206)\b/i.test(chat?.content ?? ""),
    chat?.content?.slice(0, 80),
  );

  console.log("— Voice TTS —");
  res = await fetch(`${BASE}/api/voice/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(adminToken) },
    body: JSON.stringify({ text: "Testing voice." }),
  });
  check(
    "TTS responds (200 audio or 503 fallback)",
    res.status === 200 || res.status === 503,
    `got ${res.status}`,
  );
  res = await fetch(`${BASE}/api/voice/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "x" }),
  });
  check("TTS without session → 403", res.status === 403, `got ${res.status}`);

  console.log(`\n${failed === 0 ? "✓ ALL PASSED" : "✗ FAILURES"} — ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E crashed:", e.message);
  process.exit(1);
});
