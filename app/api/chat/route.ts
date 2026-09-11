import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth-server";
import { saveTurn } from "@/lib/ai/chat-store";
import { runAgent } from "@/lib/ai/engine";
import { providerErrorMessage } from "@/lib/ai/providers";

export const maxDuration = 300;
const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(16000),
      }),
    )
    .min(1)
    .max(100),
  conversationId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const session = await getSessionUser(req);
  if (!session)
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (session.role !== "admin" && session.role !== "trainer")
    return NextResponse.json(
      { error: "Admins and trainers only." },
      { status: 403 },
    );
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Send valid user/assistant messages and a valid conversation id.",
      },
      { status: 422 },
    );
  const { messages, conversationId } = parsed.data;
  if (messages.at(-1)?.role !== "user")
    return NextResponse.json(
      { error: "The last message must be a user question." },
      { status: 422 },
    );
  const ctx = {
    userId: session.userId,
    userName: session.name,
    userEmail: session.email,
    role: session.role,
  };
  const run = async (emit: Parameters<typeof runAgent>[2]) => {
    try {
      const result = await runAgent(messages, ctx, emit, req.signal);
      const id = await saveTurn({
        conversationId,
        userId: ctx.userId,
        role: ctx.role,
        userMessage: messages.at(-1)!.content,
        assistantMessage: result.content,
        charts: result.charts,
      });
      return { ...result, conversationId: id };
    } catch (error) {
      const reason = (error as Error).message;
      console.warn("[AI]", reason);
      return {
        content: providerErrorMessage(error),
        failed: true,
        mode: "mock",
        mutated: false,
        charts: [],
        conversationId,
      };
    }
  };
  if (!(req.headers.get("accept") || "").includes("application/x-ndjson"))
    return NextResponse.json(await run(() => {}));
  const encoder = new TextEncoder();
  let cancelled = false;
  return new Response(
    new ReadableStream({
      async start(controller) {
        const write = (value: unknown) => {
          if (!cancelled && !req.signal.aborted)
            controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
        };
        try {
          write({ type: "done", ...(await run(write)) });
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    }),
    {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    },
  );
}
