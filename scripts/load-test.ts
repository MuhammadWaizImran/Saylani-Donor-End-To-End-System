/**
 * Performance test against the running dev server with 1M+ student rows.
 *
 *   npm run load:test
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

async function timed(name: string, fn: () => Promise<{ ok: boolean; note?: string }>) {
  const t0 = Date.now();
  try {
    const { ok, note } = await fn();
    const ms = Date.now() - t0;
    const flag = ms < 1500 ? "🟢" : ms < 4000 ? "🟡" : "🔴";
    console.log(`  ${ok ? "✓" : "✗"} ${flag} ${name} — ${ms}ms${note ? ` · ${note}` : ""}`);
  } catch (e) {
    console.log(`  ✗ ${name} — CRASHED: ${(e as Error).message}`);
  }
}

async function main() {
  const { data, error } = await anon.auth.signInWithPassword({
    email: "admin@saylani.org",
    password: "admin123",
  });
  if (error || !data.session) throw new Error("admin login failed");
  const admin = { Authorization: `Bearer ${data.session.access_token}` };

  const { data: t } = await anon.auth.signInWithPassword({
    email: "kashif.mehmood@saylani.org",
    password: "trainer123",
  });
  const trainer = { Authorization: `Bearer ${t!.session!.access_token}` };

  console.log(`Load test vs ${BASE} (1M+ rows)\n`);

  console.log("— Pages (server-rendered) —");
  await timed("GET / (home)", async () => ({ ok: (await fetch(`${BASE}/`)).ok }));
  await timed("GET /campaigns", async () => ({ ok: (await fetch(`${BASE}/campaigns`)).ok }));

  console.log("— Admin portal data paths —");
  await timed("students page 1 (paginated)", async () => {
    const res = await fetch(`${BASE}/portal/admin/students`, { headers: admin });
    return { ok: res.ok };
  });
  await timed("students deep page 5000", async () => {
    const res = await fetch(`${BASE}/portal/admin/students?page=5000`, { headers: admin });
    return { ok: res.ok };
  });
  await timed("students search 'ayesha khan'", async () => {
    const res = await fetch(`${BASE}/portal/admin/students?q=ayesha+khan`, { headers: admin });
    return { ok: res.ok };
  });
  await timed("students filter placed+campus", async () => {
    const res = await fetch(`${BASE}/portal/admin/students?placement=placed&campus=cp1`, { headers: admin });
    return { ok: res.ok };
  });

  console.log("— APIs —");
  await timed("trainer dashboard API", async () => {
    const res = await fetch(`${BASE}/api/portal/trainer`, { headers: trainer });
    const body = res.ok ? await res.json() : null;
    return { ok: res.ok, note: `${body?.students?.length ?? 0} students returned` };
  });
  await timed("admin records dropdowns", async () => {
    const res = await fetch(`${BASE}/api/admin/records`, { headers: admin });
    return { ok: res.ok };
  });

  console.log("— AI agent on 1M rows —");
  await timed("chat: org totals", async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...admin },
      body: JSON.stringify({
        messages: [{ role: "user", content: "How many total students do we have, and how many are placed? One line." }],
      }),
    });
    const body = res.ok ? await res.json() : null;
    const text: string = body?.content ?? "";
    const mentionsMillion = /1[,.]?0{2}[0,]*|million|10 lakh|lacs/i.test(text);
    return { ok: res.ok && body?.mode === "live", note: `${mentionsMillion ? "✓ knows 1M scale" : "⚠ " + text.slice(0, 90)}` };
  });
  await timed("chat: filtered list (placed students)", async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...admin },
      body: JSON.stringify({
        messages: [{ role: "user", content: "List 5 recently placed students with their companies and salaries." }],
      }),
    });
    const body = res.ok ? await res.json() : null;
    return { ok: res.ok && body?.mode === "live", note: (body?.content ?? "").slice(0, 80).replace(/\n/g, " ") };
  });

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Load test crashed:", e.message);
  process.exit(1);
});
