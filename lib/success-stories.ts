/**
 * Success stories — LIVE MongoDB query (server-side only), reading the
 * company's real `success_stories` collection. Only real, active entries
 * are shown — no demo padding.
 */
import { mongo } from "@/lib/mongodb";
import type { SuccessStory } from "@/types/management";

/** The collection holds test entries whose thumbnail is junk text (e.g.
 *  "aabcd"); only a real URL is worth handing to next/image. */
function asUrl(v: unknown): string {
  const s = String(v ?? "");
  return /^https?:\/\//.test(s) ? s : "";
}

function toSuccessStory(doc: Record<string, unknown>): SuccessStory {
  return {
    id: String(doc._id),
    name: String(doc.name ?? "—"),
    designation: String(doc.designation ?? ""),
    photo: asUrl(doc.thumbnail),
    story: String(doc.story ?? ""),
    description: doc.description ? String(doc.description) : undefined,
    video: doc.video ? String(doc.video) : undefined,
    order: Number(doc.order ?? 0),
  };
}

export async function getSuccessStories(): Promise<SuccessStory[]> {
  const db = await mongo();
  const docs = await db
    .collection("success_stories")
    .find({ is_active: true })
    .sort({ order: 1 })
    .toArray();

  return docs.map(toSuccessStory).sort((a, b) => a.order - b.order);
}
