/**
 * Persists AI Assistant conversations to MongoDB (`agent_conversations`) so
 * a user's chat history survives page reloads and can be resumed later.
 * Server-only. Every function no-ops (never throws) when MongoDB isn't
 * configured/reachable — the chat itself must keep working even if history
 * persistence fails.
 */
import { ObjectId } from "mongodb";
import { isMongoConfigured, mongo } from "@/lib/mongodb";

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface AgentConversationDoc {
  userId: string;
  role: "admin" | "trainer";
  title: string;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

const COLLECTION = "agent_conversations";
/** First line of the first user message, trimmed — good enough as a title. */
const TITLE_MAX = 60;

function deriveTitle(firstUserMessage: string): string {
  const line = firstUserMessage.split("\n")[0].trim();
  if (line.length <= TITLE_MAX) return line || "New conversation";
  return `${line.slice(0, TITLE_MAX).trimEnd()}…`;
}

/**
 * Appends this turn (user message + assistant reply) to a conversation,
 * creating one if `conversationId` is null/missing/not-found. Returns the
 * conversation id to use for subsequent turns, or null if persistence is
 * unavailable (chat continues normally either way).
 */
export async function saveTurn(params: {
  conversationId?: string | null;
  userId: string;
  role: "admin" | "trainer";
  userMessage: string;
  assistantMessage: string;
}): Promise<string | null> {
  if (!isMongoConfigured()) return null;
  const { conversationId, userId, role, userMessage, assistantMessage } = params;
  const now = new Date();
  const turn: StoredMessage[] = [
    { role: "user", content: userMessage, createdAt: now.toISOString() },
    { role: "assistant", content: assistantMessage, createdAt: now.toISOString() },
  ];

  try {
    const db = await mongo();
    const col = db.collection<AgentConversationDoc>(COLLECTION);

    if (conversationId && ObjectId.isValid(conversationId)) {
      const res = await col.updateOne(
        { _id: new ObjectId(conversationId), userId },
        { $push: { messages: { $each: turn } }, $set: { updatedAt: now } },
      );
      if (res.matchedCount > 0) return conversationId;
      // Stale/foreign id from the client — fall through and start a fresh one.
    }

    const inserted = await col.insertOne({
      userId,
      role,
      title: deriveTitle(userMessage),
      messages: turn,
      createdAt: now,
      updatedAt: now,
    });
    return String(inserted.insertedId);
  } catch (error) {
    console.error("[chat-store] saveTurn failed:", (error as Error).message);
    return null;
  }
}

/** Most recent conversations for this user, newest first. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  if (!isMongoConfigured()) return [];
  try {
    const db = await mongo();
    const docs = await db
      .collection(COLLECTION)
      .find({ userId })
      .project({ title: 1, updatedAt: 1, messages: 1 })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    return docs.map((d) => ({
      id: String(d._id),
      title: String(d.title ?? "Conversation"),
      updatedAt: (d.updatedAt instanceof Date ? d.updatedAt : new Date(d.updatedAt)).toISOString(),
      messageCount: Array.isArray(d.messages) ? d.messages.length : 0,
    }));
  } catch (error) {
    console.error("[chat-store] listConversations failed:", (error as Error).message);
    return [];
  }
}

/** Full message history for one conversation — only if it belongs to this user. */
export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<StoredMessage[] | null> {
  if (!isMongoConfigured() || !ObjectId.isValid(conversationId)) return null;
  try {
    const db = await mongo();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(conversationId), userId });
    if (!doc) return null;
    return (doc.messages ?? []) as StoredMessage[];
  } catch (error) {
    console.error("[chat-store] getConversation failed:", (error as Error).message);
    return null;
  }
}
