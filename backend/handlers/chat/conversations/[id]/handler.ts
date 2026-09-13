import { getSessionUser } from "@/backend/auth/session";
import { getConversation } from "@/lib/ai/chat-store";

/** Fetches one of the signed-in user's past conversations to resume it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) {
    return Response.json({ error: "Please log in to use the assistant." }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "trainer") {
    return Response.json(
      { error: "The AI assistant is restricted to admins and trainers." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const messages = await getConversation(session.userId, id);
  if (!messages) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }
  return Response.json({ messages });
}
