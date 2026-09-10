import { mongo } from "../mongodb";
import { redact } from "./schema-map";

const cache = new Map<string, { at: number; fields: Record<string, string> }>();
export async function observedFields(collection: string) {
  const cached = cache.get(collection);
  if (cached && Date.now() - cached.at < 30000) return cached.fields;
  const db = await mongo();
  const sample = await db.collection(collection).find({}).limit(20).toArray();
  const fields: Record<string, string> = {};
  const walk = (value: Record<string, unknown>, prefix = "", depth = 0) => {
    for (const [key, v] of Object.entries(value)) {
      const path = prefix + key;
      const type =
        v === null
          ? "nullable"
          : v instanceof Date
            ? "date"
            : Array.isArray(v)
              ? "array"
              : typeof v;
      fields[path] = type;
      if (
        v &&
        type === "object" &&
        !(v as { _bsontype?: string })._bsontype &&
        depth < 2
      )
        walk(v as Record<string, unknown>, path + ".", depth + 1);
    }
  };
  sample.forEach((row) => walk(redact(row)));
  cache.set(collection, { at: Date.now(), fields });
  return fields;
}
