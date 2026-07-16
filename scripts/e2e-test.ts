/**
 * End-to-end system test against the running dev server.
 *
 *   npm run e2e   (dev server must be running on :3000)
 *
 * Covers: public pages, auth login, role-based API access (positive AND
 * negative), chat agent, admin records API, TTS fallback.
 *
 * Admin/trainer accounts are the company's real MongoDB records, so this
 * script inserts a temporary test doc into `users` / `trainers` for the
 * duration of the run and deletes it in a finally block — it never leaves
 * test data behind in the real collections. The trainer test doc reuses
 * the trainer email already seeded in Postgres (kashif.mehmood@saylani.org)
 * so the (still Postgres-backed, pre-Phase-2) trainer dashboard lookup
 * still resolves. Donor uses the seeded `portal_donors` demo account.
 */
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

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

async function login(email: string, password: string, role: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(`login failed for ${email}: ${payload.error}`);
  return payload.token as string;
}

async function main() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI!);
  await mongoClient.connect();
  const db = mongoClient.db();
  const testPassword = "TestPass123";
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const testAdminEmail = "_e2e_test_admin@example.com";
  const testTrainerEmail = "kashif.mehmood@saylani.org";

  await db.collection("users").insertOne({
    email: testAdminEmail,
    password: passwordHash,
    role: "super_admin",
    status: "active",
    _testDoc: true,
  });
  const existingTrainer = await db.collection("trainers").findOne({ email: testTrainerEmail });
  if (!existingTrainer) {
    await db.collection("trainers").insertOne({
      email: testTrainerEmail,
      password: passwordHash,
      en: { trainer_name: "Kashif Mehmood" },
      _testDoc: true,
    });
  } else {
    await db.collection("trainers").updateOne(
      { _id: existingTrainer._id },
      { $set: { password: passwordHash } },
    );
  }
  const originalTrainerPassword = existingTrainer?.password;

  try {
    console.log("— Public pages —");
    for (const path of ["/", "/campaigns", "/donate", "/contact", "/auth/login", "/auth/signup", "/nope-404"]) {
      const res = await fetch(`${BASE}${path}`);
      const want = path === "/nope-404" ? 404 : 200;
      check(`GET ${path} → ${want}`, res.status === want, `got ${res.status}`);
    }

    console.log("— Auth —");
    const adminToken = await login(testAdminEmail, testPassword, "admin");
    const trainerToken = await login(testTrainerEmail, testPassword, "trainer");
    const donorToken = await login("donor@saylani.org", "donor123", "donor");
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
      body: JSON.stringify({ name: "Evil Admin", email: "evil@x.com", password: "hack123", role: "admin" }),
    });
    check("signup with non-donor role → 422", res.status === 422, `got ${res.status}`);

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
      "answer states real campus count (7 from MongoDB)",
      /\b(7|seven)\b/i.test(chat?.content ?? ""),
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
  } finally {
    await db.collection("users").deleteOne({ email: testAdminEmail, _testDoc: true });
    if (!existingTrainer) {
      await db.collection("trainers").deleteOne({ email: testTrainerEmail, _testDoc: true });
    } else {
      await db.collection("trainers").updateOne(
        { _id: existingTrainer._id },
        { $set: { password: originalTrainerPassword } },
      );
    }
    await mongoClient.close();
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E crashed:", e.message);
  process.exit(1);
});
