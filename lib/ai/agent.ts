"use client";

/**
 * Client entry point for Saylani Intelligence.
 *
 * Sends the conversation to /api/chat, where the Groq-powered agent loop
 * runs server-side (tool calling over portal data). If the network call
 * fails entirely, it degrades to the local offline brain so the assistant
 * never hard-fails.
 */
import { mockBrain, type AgentContext } from "@/lib/ai/mock-brain";

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
}

export const AGENT_MODEL_LABEL = "Groq · Llama 3.3 70B";

export async function askAgent(history: ChatMessage[], ctx: AgentContext): Promise<AgentReply> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        role: ctx.role,
        userName: ctx.userName,
        userEmail: ctx.userEmail,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as AgentReply;
    return { content: data.content, mode: data.mode ?? "mock", mutated: data.mutated };
  } catch {
    const question = history.filter((m) => m.role === "user").at(-1)?.content ?? "";
    return { content: mockBrain(question, ctx), mode: "mock" };
  }
}
