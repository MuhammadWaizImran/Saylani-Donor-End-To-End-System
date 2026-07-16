import { MongoClient, type Db } from "mongodb";

/**
 * MongoDB connection singleton — the app's single data backend.
 *
 * MONGODB_URI must be the expanded non-SRV connection string (three shard
 * hosts + authSource/replicaSet params), not `mongodb+srv://` — Node's SRV
 * DNS lookup fails in this environment even though direct `nslookup`
 * succeeds, so we bypass it entirely. See .env.local for the working form.
 *
 * Cached as a module-level promise (not just a client) so concurrent calls
 * during a cold start all await the same in-flight connection instead of
 * racing to open several.
 */

let dbPromise: Promise<Db> | null = null;

export function mongo(): Promise<Db> {
  if (!dbPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MongoDB not configured — set MONGODB_URI in .env.local");
    }
    dbPromise = new MongoClient(uri).connect().then((client) => client.db());
  }
  return dbPromise;
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}
