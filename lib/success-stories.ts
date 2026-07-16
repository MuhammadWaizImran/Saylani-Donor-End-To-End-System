/**
 * Success stories — LIVE MongoDB query (server-side only), reading the
 * company's real `success_stories` collection. That collection currently
 * holds only 2 placeholder entries, so a few clearly-marked demo stories
 * are appended for now; drop the DEMO_STORIES block once the company adds
 * real content.
 */
import { mongo } from "@/lib/mongodb";
import type { SuccessStory } from "@/types/management";

const DEMO_STORIES: SuccessStory[] = [
  {
    id: "demo-1",
    name: "Ayesha Siddiqui",
    designation: "Frontend Developer at Systems Limited",
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces",
    story:
      "I joined SMIT with zero coding background. Within eight months of the Web Development course, I landed my first job as a Frontend Developer. The trainers didn't just teach syntax — they taught how to think like an engineer.",
    order: 101,
    isDemo: true,
  },
  {
    id: "demo-2",
    name: "Bilal Ahmed",
    designation: "Data Analyst at Careem",
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces",
    story:
      "Coming from a non-technical background, I never imagined I'd work with data pipelines and dashboards for a living. SMIT's free training and placement support changed the direction of my entire career.",
    order: 102,
    isDemo: true,
  },
  {
    id: "demo-3",
    name: "Sana Malik",
    designation: "Graphic Designer, Freelance",
    photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=faces",
    story:
      "As a mother of two, going back to a classroom felt impossible — until I found SMIT's flexible batch timings. Today I run my own freelance design practice and mentor other women trying to do the same.",
    order: 103,
    isDemo: true,
  },
];

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

  const real = docs.map(toSuccessStory);
  return [...real, ...DEMO_STORIES].sort((a, b) => a.order - b.order);
}
