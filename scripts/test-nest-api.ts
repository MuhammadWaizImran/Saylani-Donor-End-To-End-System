import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { decodeJwt } from "jose";
import { mongo } from "../lib/mongodb";

async function main() {
  const base = process.env.TEST_BASE_URL || "http://localhost:4000";
  const db = await mongo();
  const email = `nest-test-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const user = await db.collection("users").insertOne({ name: "Migration Test", email, password: await bcrypt.hash(password, 10), role: "admin", status: "active", isTestAccount: true });
  let jti: string | undefined;
  const request = (path: string, init?: RequestInit) => fetch(base + path, init);
  try {
    assert.equal((await (await request("/api/health")).json()).backend, "nestjs");
    assert.equal((await request("/api/admin/records")).status, 401);
    assert.equal((await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
    const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role: "admin" }) });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("x-backend"), "nestjs");
    const { token } = await login.json();
    jti = decodeJwt(token).jti;
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.match(login.headers.get("set-cookie")!, /HttpOnly/i);
    const headers = { Cookie: cookie };
    assert.equal((await (await request("/api/auth/session", { headers })).json()).session.email, email);
    assert.equal((await (await request("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } })).json()).session.email, email);
    assert.equal((await request("/api/portal/trainer", { headers })).status, 403);
    assert.equal((await request("/api/chat/conversations/000000000000000000000000", { headers })).status, 404);
    const pdf = await request("/api/reports/sponsorship", { headers });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-type")!, /application\/pdf/);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
    const logout = await request("/api/auth/logout", { method: "POST", headers });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
    assert.equal((await (await request("/api/auth/session", { headers })).json()).session, null);
    console.log("PASS Nest health, auth cookies/bearer, malformed JSON, role checks, dynamic routes, PDF streaming and logout revocation", base);
  } finally {
    await db.collection("users").deleteOne({ _id: user.insertedId });
    if (jti) await db.collection("revoked_sessions").deleteOne({ jti });
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
