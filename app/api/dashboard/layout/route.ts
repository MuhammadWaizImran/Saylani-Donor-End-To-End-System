import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth-server";
import { mongo } from "@/lib/mongodb";
import { changeLayout, defaultChartIds } from "@/lib/ai/dashboard-layout";

const idSchema = z
  .string()
  .refine((id) => /^[a-f0-9]{24}$/i.test(id) || defaultChartIds.includes(id));
const mutation = z.object({
  id: idSchema,
  action: z.enum(["pin", "move", "remove"]),
  target: idSchema.optional(),
  placement: z.enum(["before", "replace"]).optional(),
  revision: z.number().int().nonnegative().optional(),
});
type Board = {
  _id: string;
  layout?: string[];
  pins?: { id: string; slot: number }[];
  revision: number;
};
function layout(board: Board | null, role: string) {
  return (
    board?.layout ?? [
      ...(role === "admin" ? defaultChartIds : []),
      ...(board?.pins ?? [])
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((p) => p.id),
    ]
  );
}
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user || !["admin", "trainer"].includes(user.role))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const db = await mongo();
  const board = await db
    .collection<Board>("portal_chart_boards")
    .findOne({ _id: user.userId });
  const items = layout(board, user.role);
  const charts = await db
    .collection("portal_ai_charts")
    .find({
      _id: {
        $in: items
          .filter((id) => !id.startsWith("builtin:"))
          .map((id) => new ObjectId(id)),
      },
      ownerId: user.userId,
      role: user.role,
    })
    .toArray();
  return NextResponse.json(
    {
      items: items.filter(
        (id) =>
          id.startsWith("builtin:") || charts.some((c) => String(c._id) === id),
      ),
      charts: charts.map((c) => c.chart),
      revision: board?.revision ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user || !["admin", "trainer"].includes(user.role))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const parsed = mutation.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid layout change" },
      { status: 422 },
    );
  const data = parsed.data;
  const db = await mongo();
  if (data.id.startsWith("builtin:")) {
    if (user.role !== "admin")
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  } else if (
    !(await db
      .collection("portal_ai_charts")
      .findOne({
        _id: new ObjectId(data.id),
        ownerId: user.userId,
        role: user.role,
      }))
  )
    return NextResponse.json({ error: "Chart not found" }, { status: 404 });
  const boards = db.collection<Board>("portal_chart_boards");
  for (let attempt = 0; attempt < 3; attempt++) {
    const board = await boards.findOne({ _id: user.userId });
    if (data.revision !== undefined && data.revision !== (board?.revision ?? 0))
      return NextResponse.json(
        { error: "Layout changed in another tab. Please retry." },
        { status: 409 },
      );
    let items: string[];
    try {
      items = changeLayout(layout(board, user.role), data);
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 409 },
      );
    }
    if (board) {
      const saved = await boards.updateOne(
        { _id: user.userId, revision: board.revision },
        { $set: { layout: items }, $inc: { revision: 1 } },
      );
      if (saved.modifiedCount) return NextResponse.json({ success: true });
    } else {
      try {
        await boards.insertOne({
          _id: user.userId,
          layout: items,
          revision: 1,
        });
        return NextResponse.json({ success: true });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
  }
  return NextResponse.json(
    { error: "Layout changed. Please retry." },
    { status: 409 },
  );
}
