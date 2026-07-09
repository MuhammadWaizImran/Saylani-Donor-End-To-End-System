/**
 * Creates the demo portal accounts in Supabase Auth (pre-confirmed).
 *
 *   npm run auth:seed
 *
 * Safe to re-run — existing accounts are left untouched.
 */
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: join(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ Supabase env vars missing in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const demoUsers = [
  { email: "admin@saylani.org", password: "admin123", name: "Muhammad Yousuf", role: "admin" },
  { email: "donor@saylani.org", password: "donor123", name: "Ahmed Raza", role: "donor" },
  { email: "kashif.mehmood@saylani.org", password: "trainer123", name: "Kashif Mehmood", role: "trainer" },
];

async function main() {
  for (const user of demoUsers) {
    const { error } = await db.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role },
    });
    if (error) {
      if (/already been registered/i.test(error.message)) {
        console.log(`  = ${user.email} (${user.role}) — already exists`);
      } else {
        throw new Error(`${user.email}: ${error.message}`);
      }
    } else {
      console.log(`  ✓ ${user.email} (${user.role}) created`);
    }
  }
  console.log("\n✓ Demo accounts ready.");
}

main().catch((error) => {
  console.error("✗ Auth seed failed:", error.message);
  process.exit(1);
});
