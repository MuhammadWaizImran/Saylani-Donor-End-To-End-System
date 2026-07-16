/**
 * Creates the demo donor account used for local/e2e testing.
 *
 *   npm run auth:seed
 *
 * Admin and trainer accounts are the company's real MongoDB records
 * (`users` / `trainers`) and aren't seeded here — log in with a real
 * account, or use the temporary-account pattern in scripts/e2e-test.ts for
 * automated testing. Donor accounts have no real-data equivalent, so they
 * live in our own `portal_donors` collection and are safe to seed.
 *
 * Safe to re-run — an existing donor account is left untouched.
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

const demoDonor = { email: "donor@saylani.org", password: "donor123", name: "Ahmed Raza" };

async function main() {
  const client = new MongoClient(uri!);
  await client.connect();
  const donors = client.db().collection("portal_donors");

  const existing = await donors.findOne({ email: demoDonor.email });
  if (existing) {
    console.log(`  = ${demoDonor.email} (donor) — already exists`);
  } else {
    const passwordHash = await bcrypt.hash(demoDonor.password, 10);
    await donors.insertOne({
      name: demoDonor.name,
      email: demoDonor.email,
      password: passwordHash,
      createdAt: new Date(),
    });
    console.log(`  ✓ ${demoDonor.email} (donor) created`);
  }

  await client.close();
  console.log("\n✓ Demo donor account ready.");
}

main().catch((error) => {
  console.error("✗ Auth seed failed:", error.message);
  process.exit(1);
});
