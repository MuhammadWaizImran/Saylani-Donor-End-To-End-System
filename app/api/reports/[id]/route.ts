import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { mongo } from "@/lib/mongodb";
import { getSessionUser } from "@/lib/auth-server";

/**
 * Serves an AI-generated Word report from MongoDB GridFS. Session-gated to
 * the same roles that can generate reports (admin/trainer).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session || (session.role !== "admin" && session.role !== "trainer")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const db = await mongo();
  const _id = new ObjectId(id);
  const file = await db.collection("reports.files").findOne({ _id });
  if (!file) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const bucket = new GridFSBucket(db, { bucketName: "reports" });
  const chunks: Buffer[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      bucket
        .openDownloadStream(_id)
        .on("data", (c: Buffer) => chunks.push(c))
        .on("error", reject)
        .on("end", () => resolve());
    });
  } catch {
    return NextResponse.json({ error: "Could not read report" }, { status: 500 });
  }

  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${String(file.filename ?? "report.docx")}"`,
      "Cache-Control": "no-store",
    },
  });
}
