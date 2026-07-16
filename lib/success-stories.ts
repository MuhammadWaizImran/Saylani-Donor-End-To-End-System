/**
 * Success stories — LIVE MongoDB query (server-side only), reading the
 * company's real `success_stories` collection. Only real, active entries
 * are shown — no demo padding.
 */
import { mongo } from "@/lib/mongodb";
import type { SuccessStory } from "@/types/management";

function toSuccessStory(doc: Record<string, unknown>): SuccessStory {
  return {
    id: String(doc._id),
    name: String(doc.name ?? "—"),
    designation: String(doc.designation ?? ""),
    photo: String(doc.thumbnail ?? ""),
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
