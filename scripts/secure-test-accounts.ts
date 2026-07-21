/**
 * Finds and neutralises the known-password test accounts that seeding left in
 * the live `users` collection.
 *
 * Why this exists: scripts/seed-test-admin.ts creates a super_admin whose
 * password is written in plain text in that file, and this repository is
 * public. Anyone who reads it can sign into production as a super_admin and
 * see every student's CNIC, date of birth, phone number and address. The
 * account is genuinely useful during development, so the answer isn't to
 * never create it — it's to make sure it can't survive into production with
 * a password the whole internet already knows.
 *
 * Runs as a DRY RUN unless told otherwise, because it edits live data:
 *
 *   npm run secure:test-accounts            # report only, changes nothing
 *   npm run secure:test-accounts -- --rotate  # replace passwords, keep rows
 *   npm run secure:test-accounts -- --delete  # remove the rows entirely
 *
 * --rotate is the safer of the two. Deleting a user row orphans any record
 * whose updated_by / action_by points at it, which is exactly the breakage
 * already visible elsewhere in this database (26 scholarships reference a
 * student that no longer exists).
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { mongo } from "@/lib/mongodb";

/** Flagged by our own seed scripts, plus the address shapes a real staff
 *  account would never use. `bilal@test.com` is a super_admin carrying no
 *  flag at all, so a flag-only sweep would walk straight past it. */
const TEST_ACCOUNT_FILTER = {
  $or: [
    { isTestAccount: true },
    { _isPortalTestAccount: true },
    { email: { $regex: "@test\\.com$|@example\\.com$|\\.local$|^test[.@]", $options: "i" } },
  ],
};

function strongPassword(): string {
  return randomBytes(24).toString("base64url");
}

async function main() {
  const rotate = process.argv.includes("--rotate");
  const remove = process.argv.includes("--delete");

  if (rotate && remove) {
    console.error("Pick one: --rotate or --delete, not both.");
    process.exit(1);
  }

  const db = await mongo();
  const users = db.collection("users");
  const found = await users.find(TEST_ACCOUNT_FILTER).project({ email: 1, role: 1, status: 1 }).toArray();

  if (found.length === 0) {
    console.log("No test accounts found in `users`. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${found.length} test account(s) in the live \`users\` collection:\n`);
  for (const u of found) {
    console.log(`  ${String(u.email).padEnd(38)} role=${u.role ?? "(none)"} status=${u.status ?? "(none)"}`);
  }
  console.log("");

  if (!rotate && !remove) {
    console.log("DRY RUN — nothing was changed.");
    console.log("  npm run secure:test-accounts -- --rotate   replace each password with a random one");
    console.log("  npm run secure:test-accounts -- --delete   remove these rows entirely");
    process.exit(0);
  }

  if (remove) {
    const res = await users.deleteMany(TEST_ACCOUNT_FILTER);
    console.log(`Deleted ${res.deletedCount} account(s).`);
    console.log("Any record whose updated_by/action_by pointed at them now references a missing row.");
    process.exit(0);
  }

  // Rotate: a fresh random password each, printed once and never stored
  // anywhere but the hash. Nobody is expected to keep these — the point is
  // that the published one stops working.
  console.log("New passwords (shown once — copy them now if you want to keep any):\n");
  for (const u of found) {
    const password = strongPassword();
    await users.updateOne({ _id: u._id }, { $set: { password: await bcrypt.hash(password, 10) } });
    console.log(`  ${String(u.email).padEnd(38)} ${password}`);
  }
  console.log("\nDone. The password committed in scripts/seed-test-admin.ts no longer works.");
  console.log("Still worth doing: rotate AUTH_JWT_SECRET, so any session already");
  console.log("signed in with the old password stops working too (they last 7 days).");
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed:", (error as Error).message);
  process.exit(1);
});
