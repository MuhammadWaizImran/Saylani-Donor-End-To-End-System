/**
 * Creates a KNOWN test admin account for manual/live testing.
 *
 *   npm run seed:test-admin
 *
 * The company's real admins live in `users` with passwords we don't know, so
 * this adds one admin with credentials you control. Safe to re-run — it resets
 * this test account's password rather than creating duplicates.
 *
 * Delete it before launch (it's a known-password account):
 *   db.users.deleteOne({ email: "admin@test.com" })
 */
import { join } from "node:path";
import { config } from "dotenv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

config({ path: join(process.cwd(), ".env.local") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI missing in .env.local");
  process.exit(1);
}

const admin = { email: "admin@test.com", password: "admin123", name: "Test Admin" };

async function main() {
  const client = new MongoClient(uri!);
  await client.connect();
  const users = client.db().collection("users");

  const passwordHash = await bcrypt.hash(admin.password, 10);
  await users.updateOne(
    { email: admin.email },
    { $set: { name: admin.name, email: admin.email, password: passwordHash, role: "super_admin", isTestAccount: true } },
    { upsert: true },
  );

  console.log("✓ Test admin ready:");
  console.log(`    email:    ${admin.email}`);
  console.log(`    password: ${admin.password}`);
  console.log("    role tab: Admin");
  await client.close();
}

main().catch((error) => {
  console.error("✗ Seed failed:", error.message);
  process.exit(1);
});
