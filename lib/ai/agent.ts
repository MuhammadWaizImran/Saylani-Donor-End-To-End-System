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
  /** For assistant messages: the trace of tool calls that produced it,
   *  shown as an expandable "thinking" panel. */
  steps?: AgentStep[];
}

export type AgentMode = "live" | "mock";

/** One entry in the live "thinking" trace — either a plain step or a tool
 *  call with the exact query it ran. */
export interface AgentStep {
  type: "step" | "tool";
  label: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export interface AgentReply {
  content: string;
  mode: AgentMode;
  /** True when the agent created, edited, or deleted a record this turn —
   *  the UI uses it to refresh dashboard views. */
  mutated?: boolean;
  /** The chat-history conversation this turn was saved under (null if
   *  persistence is unavailable — the chat still works without it). */
  conversationId?: string | null;
  /** The trace of everything the agent did to reach this answer. */
  steps?: AgentStep[];
}

export async function askAgent(
  history: ChatMessage[],
  ctx: AgentContext,
  conversationId?: string | null,
  /** Called as each step happens, so the UI can show a live thinking trace. */
  onStep?: (step: AgentStep) => void,
): Promise<AgentReply> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        role: ctx.role,
        userName: ctx.userName,
        userEmail: ctx.userEmail,
        conversationId,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`API ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const steps: AgentStep[] = [];
    let buffer = "";
    let done: AgentReply | null = null;

    // NDJSON: parse whole lines as they arrive; the last one is the answer.
    for (;;) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const evt = JSON.parse(line) as { type: string; label?: string; tool?: string; args?: Record<string, unknown> } & Partial<AgentReply>;
        if (evt.type === "done") {
          done = {
            content: evt.content ?? AI_UNAVAILABLE_MESSAGE,
            mode: evt.mode ?? "mock",
            mutated: evt.mutated,
            conversationId: evt.conversationId,
            steps,
          };
        } else {
          const step: AgentStep = { type: evt.type as AgentStep["type"], label: evt.label ?? "", tool: evt.tool, args: evt.args };
          steps.push(step);
          onStep?.(step);
        }
      }
    }

    return done ?? { content: AI_UNAVAILABLE_MESSAGE, mode: "mock", steps };
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
