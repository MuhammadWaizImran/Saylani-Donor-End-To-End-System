import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth-server";
import { mongo } from "@/lib/mongodb";

const mutation = z.object({
  action: z.enum(["pin", "move", "remove"]),
  id: z.string().regex(/^[a-f0-9]{24}$/i),
  slot: z.number().int().min(0).max(23).optional(),
});
type Pin = { id: string; slot: number };
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user || !["admin", "trainer"].includes(user.role))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const db = await mongo();
  const board = await db
    .collection<{ _id: string; pins: Pin[] }>("portal_chart_boards")
    .findOne({ _id: user.userId });
  const pins: Pin[] = board?.pins ?? [];
  const docs = await db
    .collection("portal_ai_charts")
    .find({
      _id: { $in: pins.map((p) => new ObjectId(p.id)) },
      ownerId: user.userId,
      role: user.role,
    })
    .toArray();
  return NextResponse.json(
    {
      charts: pins.flatMap((p) => {
        const doc = docs.find((d) => String(d._id) === p.id);
        return doc ? [{ ...p, chart: doc.chart }] : [];
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user || !["admin", "trainer"].includes(user.role))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  let parsed;
  try {
    parsed = mutation.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid chart placement" },
      { status: 422 },
    );
  const { action, id, slot } = parsed.data;
  const db = await mongo();
  const chart = await db
    .collection("portal_ai_charts")
    .findOne({ _id: new ObjectId(id), ownerId: user.userId, role: user.role });
  if (!chart)
    return NextResponse.json({ error: "Chart not found" }, { status: 404 });
  const boards = db.collection<{ _id: string; pins: Pin[]; revision: number }>(
    "portal_chart_boards",
  );
  // Optimistic retry avoids overwriting another tab's layout changes.
  for (let attempt = 0; attempt < 3; attempt++) {
    const board = await boards.findOne({ _id: user.userId });
    const pins: Pin[] = [...(board?.pins ?? [])];
    const existing = pins.find((p) => p.id === id);
    if (action === "remove") {
      const index = pins.findIndex((p) => p.id === id);
      if (index >= 0) pins.splice(index, 1);
    } else {
      const target =
        slot ??
        existing?.slot ??
        Array.from({ length: 24 }, (_, i) => i).find(
          (i) => !pins.some((p) => p.slot === i),
        );
      if (target === undefined)
        return NextResponse.json(
          { error: "Dashboard is full. Remove a chart first." },
          { status: 409 },
        );
      const occupied = pins.find((p) => p.slot === target && p.id !== id);
      if (occupied) {
        if (existing) occupied.slot = existing.slot;
        else
          return NextResponse.json(
            { error: "Choose an empty position." },
            { status: 409 },
          );
      }
      if (existing) existing.slot = target;
      else pins.push({ id, slot: target });
    }
    if (board) {
      const saved = await boards.updateOne(
        { _id: user.userId, revision: board.revision },
        { $set: { pins }, $inc: { revision: 1 } },
      );
      if (saved.modifiedCount) return NextResponse.json({ success: true });
    } else {
      try {
        await boards.insertOne({ _id: user.userId, pins, revision: 1 });
        return NextResponse.json({ success: true });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
  }
  return NextResponse.json(
    { error: "Layout changed in another tab. Please retry." },
    { status: 409 },
  );
}
