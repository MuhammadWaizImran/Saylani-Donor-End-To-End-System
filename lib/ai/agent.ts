"use client";

/**
 * Client entry point for Saylani Intelligence.
 *
 * Sends the conversation to /api/chat, where the Groq-powered agent loop
 * runs server-side (tool calling over portal data). If the network call
 * fails entirely, it says so plainly rather than inventing an answer.
 */
import { AI_UNAVAILABLE_MESSAGE, type AgentContext } from "@/lib/ai/context";

export type { AgentContext };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type AgentMode = "live" | "mock";

export interface AgentReply {
  content: string;
  mode: AgentMode;
  /** True when the agent created, edited, or deleted a record this turn —
   *  the UI uses it to refresh dashboard views. */
  mutated?: boolean;
  /** The chat-history conversation this turn was saved under (null if
   *  persistence is unavailable — the chat still works without it). */
  conversationId?: string | null;
}

export async function askAgent(
  history: ChatMessage[],
  ctx: AgentContext,
  conversationId?: string | null,
): Promise<AgentReply> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        role: ctx.role,
        userName: ctx.userName,
        userEmail: ctx.userEmail,
        conversationId,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as AgentReply;
    return {
      content: data.content,
      mode: data.mode ?? "mock",
      mutated: data.mutated,
      conversationId: data.conversationId,
    };
  } catch {
    return { content: AI_UNAVAILABLE_MESSAGE, mode: "mock" };
  }
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

/** Lists the signed-in user's saved conversations, newest first. */
export async function listConversations(): Promise<ConversationSummary[]> {
  try {
    const res = await fetch("/api/chat/conversations");
    if (!res.ok) return [];
    const data = (await res.json()) as { conversations: ConversationSummary[] };
    return data.conversations;
  } catch {
    return [];
  }
}

/** Loads one past conversation's full message list to resume it. */
export async function loadConversation(id: string): Promise<ChatMessage[] | null> {
  try {
    const res = await fetch(`/api/chat/conversations/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string; createdAt: string }>;
    };
    return data.messages.map((m, i) => ({
      id: `${id}-${i}`,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  } catch {
    return null;
  }
}
