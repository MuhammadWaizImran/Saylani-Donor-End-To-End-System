import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { listConversations } from "@/lib/ai/chat-store";

/** Lists the signed-in user's AI Assistant conversations, newest first. */
export async function GET(req: Request) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Please log in to use the assistant." }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "trainer") {
    return NextResponse.json(
      { error: "The AI assistant is restricted to admins and trainers." },
      { status: 403 },
    );
  }

  const conversations = await listConversations(session.userId);
  return NextResponse.json({ conversations });
}
