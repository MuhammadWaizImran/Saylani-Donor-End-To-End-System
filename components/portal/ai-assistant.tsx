"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import {
  ArrowUp,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileText,
  History,
  MessageSquareText,
  Mic,
  PanelLeftClose,
  PlusCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { UserRole } from "@/types/management";
import {
  askAgent,
  listConversations,
  loadConversation,
  type AgentMode,
  type AgentStep,
  type ChatMessage,
  type ConversationSummary,
} from "@/lib/ai/agent";
import { useSession } from "@/lib/auth";
import { useVoice, voiceSupported, type VoiceLang } from "@/lib/voice";
import { Avatar } from "@/components/portal/ui";
import { FireflyParticles } from "@/components/portal/firefly-particles";
import { cn, timeAgo } from "@/lib/utils";

const noopSubscribe = () => () => {};

/* Suggestions only ever point at questions the tools can genuinely answer —
 * placements/progress aren't tracked in the database, so no chip offers them. */
const adminPrompts = [
  { title: "Executive summary", prompt: "Give me an executive summary of the whole organization." },
  { title: "Campus health", prompt: "Which campus needs attention right now?" },
  { title: "Course enrolment", prompt: "Which courses have the most students enrolled?" },
  { title: "Trainer overview", prompt: "List my trainers with their campuses and hourly rates." },
];

const trainerPrompts = [
  { title: "My students", prompt: "List my students with their courses." },
  { title: "My batches", prompt: "Summarize the batches I teach." },
  { title: "My courses", prompt: "Which courses am I teaching right now?" },
  { title: "Class schedule", prompt: "Show my active classes." },
];

const timeFormatter = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

/** The agent prints this literal token when offering a document-vs-chat
 *  choice for a big analysis (see the BIG-ANALYSIS CONFIRMATION rule in
 *  app/api/chat/route.ts). Stripped from display/speech; its presence on
 *  the latest assistant message renders the choice buttons below. */
const OFFER_MARKER = "[[OFFER_DOCUMENT]]";

/**
 * The "thinking" trace. While the agent works (`live`), it shows the current
 * step as an animated, shimmering line so the wait reads as progress rather
 * than a dead spinner. Click it — live or afterwards — to expand every tool
 * call the agent made, with the exact query it ran against the database.
 */
function ThinkingTrace({ steps, live = false }: { steps: AgentStep[]; live?: boolean }) {
  const [open, setOpen] = useState(false);
  const tools = steps.filter((s) => s.type === "tool");
  const latest = steps[steps.length - 1];
  // Live with nothing yet: a plain "Thinking…" shimmer. Live with steps: the
  // newest step's label. Done: a summary of how much work it took.
  const headline = live
    ? (latest?.label ?? "Thinking…")
    : tools.length === 0
      ? "Answered directly"
      : `Looked at ${tools.length} ${tools.length === 1 ? "query" : "queries"}`;

  return (
    <div className="min-w-0 max-w-[85%]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group inline-flex max-w-full items-center gap-1.5 rounded-2xl rounded-tl-sm border border-edge bg-surface-muted px-3.5 py-2.5 text-left text-sm text-ink-muted transition-colors hover:border-brand-400"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden
        />
        <span className={cn("truncate", live && "shimmer-text font-medium text-ink")}>{headline}</span>
        {live && (
          <span className="ml-1 inline-flex shrink-0 gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                className="h-1 w-1 rounded-full bg-accent-500"
              />
            ))}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && tools.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 space-y-1.5 overflow-hidden pl-1"
          >
            {tools.map((s, i) => (
              <li key={i} className="rounded-lg border border-edge/70 bg-surface px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Database className="h-3 w-3 shrink-0 text-brand-600" aria-hidden />
                  {s.label}
                </div>
                {s.args && Object.keys(s.args).length > 0 && (
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-muted">
                    {formatArgs(s.args)}
                  </pre>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Compact one-line-ish view of a tool call's arguments, dropping nulls. */
function formatArgs(args: Record<string, unknown>): string {
  const clean = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== null && v !== undefined && v !== ""));
  return Object.keys(clean).length ? JSON.stringify(clean, null, 1).replace(/\n\s*/g, " ").replace(/([{,])/g, "$1 ") : "no filters";
}

export function AiAssistant({ role }: { role: Extract<UserRole, "admin" | "trainer"> }) {
  const router = useRouter();
  const session = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  /* ── chat history panel ────────────────────────────────────── */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistory(await listConversations());
    setHistoryLoading(false);
  };

  const resumeConversation = async (id: string) => {
    if (id === conversationId) {
      setHistoryOpen(false);
      return;
    }
    setResumingId(id);
    const loaded = await loadConversation(id);
    if (loaded) {
      setMessages(loaded);
      setConversationId(id);
      setMode(null);
    }
    setResumingId(null);
    setHistoryOpen(false);
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setMode(null);
  };

  const prompts = role === "admin" ? adminPrompts : trainerPrompts;
  const userName = session?.name ?? "there";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text: string): Promise<string | null> => {
    const trimmed = text.trim();
    if (!trimmed || thinking || !session) return null;
    const userMessage: ChatMessage = {
      id: `m-${++idCounter.current}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setThinking(true);
    setLiveSteps([]);
    try {
      const reply = await askAgent(
        history,
        { userId: session.userId, role, userName: session.name, userEmail: session.email },
        conversationId,
        (step) => setLiveSteps((prev) => [...prev, step]),
      );
      setMode(reply.mode);
      if (reply.conversationId) setConversationId(reply.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${++idCounter.current}-a`,
          role: "assistant",
          content: reply.content,
          createdAt: new Date().toISOString(),
          steps: reply.steps,
        },
      ]);
      // The agent just created / edited / deleted a record — invalidate the
      // Next.js client cache so every dashboard list reflects the change.
      if (reply.mutated) router.refresh();
      return reply.content;
    } finally {
      setThinking(false);
      setLiveSteps([]);
    }
  };

  /* ── voice mode: same pipeline, hands-free ────────────────── */
  const canUseVoice = useSyncExternalStore(noopSubscribe, voiceSupported, () => false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const voice = useVoice({ onUtterance: send });

  const openVoice = () => {
    setVoiceOpen(true);
    voice.start();
  };
  const closeVoice = () => {
    voice.stop();
    setVoiceOpen(false);
  };

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard unavailable — ignore.
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-br from-brand-50 via-surface to-accent-50">
      {/* Firefly ambience — sits behind everything else in this container */}
      <FireflyParticles />

      {/* History toggle */}
      <button
        type="button"
        onClick={openHistory}
        aria-label="Chat history"
        title="Chat history"
        className="absolute left-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-edge bg-surface/90 text-ink-muted shadow-sm backdrop-blur transition-all hover:scale-105 hover:border-brand-400 hover:text-brand-700"
      >
        <History className="h-4 w-4" aria-hidden />
      </button>

      {/* Messages */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 pb-6 pt-16">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center text-center">
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-solid to-accent-500 text-white shadow-xl shadow-accent-500/30"
            >
              <Sparkles className="h-7 w-7" aria-hidden />
            </motion.span>
            <h3 className="mt-6 font-display text-3xl text-ink-strong">
              Assalam-o-Alaikum, <em className="text-ink-muted">{userName.split(" ")[0]}</em>
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
              Ask me anything about {role === "admin" ? "campuses, students, trainers, courses, and classes" : "your students, batches, and classes"} — I&apos;ll pull the data for you instantly.
            </p>
            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {prompts.map((p, i) => (
                <motion.button
                  key={p.title}
                  type="button"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
                  onClick={() => send(p.prompt)}
                  className="portal-glow portal-glow-plain group rounded-2xl border border-edge bg-surface p-4 text-left transition-all hover:-translate-y-0.5"
                >
                  <p className="text-sm font-bold text-ink group-hover:text-brand-700">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{p.prompt}</p>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((message, index) => {
                const offersDocument = message.role === "assistant" && message.content.includes(OFFER_MARKER);
                const isLatest = index === messages.length - 1;
                const displayContent = offersDocument
                  ? message.content.replace(OFFER_MARKER, "").trim()
                  : message.content;
                return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "")}
                >
                  {message.role === "assistant" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-solid to-accent-500 text-white shadow">
                      <Bot className="h-4 w-4" aria-hidden />
                    </span>
                  ) : (
                    <Avatar name={userName} />
                  )}
                  <div
                    className={cn(
                      "group min-w-0",
                      message.role === "user" ? "max-w-[85%] text-right" : "max-w-[92%]",
                    )}
                  >
                    {message.role === "assistant" && message.steps && message.steps.some((s) => s.type === "tool") && (
                      <div className="mb-1.5">
                        <ThinkingTrace steps={message.steps} />
                      </div>
                    )}
                    <div
                      className={cn(
                        "inline-block max-w-full rounded-2xl px-4 py-3 text-left text-sm leading-relaxed",
                        message.role === "user"
                          ? "whitespace-pre-wrap rounded-tr-sm bg-brand-solid text-white"
                          : "rounded-tl-sm border border-edge bg-surface-muted text-ink",
                      )}
                    >
                      {message.role === "assistant" ? <MessageBody content={displayContent} /> : displayContent}
                    </div>
                    {offersDocument && isLatest && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={thinking}
                          onClick={() => send("Yes, please create a Word document for this.")}
                          className="portal-glow inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-100 disabled:opacity-50"
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          Word Document
                        </button>
                        <button
                          type="button"
                          disabled={thinking}
                          onClick={() => send("No, just show me the answer here in the chat.")}
                          className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent-400 hover:bg-surface-muted disabled:opacity-50"
                        >
                          <MessageSquareText className="h-4 w-4" aria-hidden />
                          Show in Chat
                        </button>
                      </div>
                    )}
                    <div
                      className={cn(
                        "mt-1.5 flex items-center gap-2 text-[10px] text-ink-muted/80",
                        message.role === "user" ? "justify-end" : "",
                      )}
                    >
                      <span>{timeFormatter.format(new Date(message.createdAt))}</span>
                      {message.role === "assistant" && (
                        <button
                          type="button"
                          onClick={() => copyMessage(message)}
                          aria-label="Copy response"
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 opacity-0 transition-opacity hover:text-brand-700 group-hover:opacity-100"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check className="h-3 w-3 text-accent-600" aria-hidden /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" aria-hidden /> Copy
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>

            {thinking && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-solid to-accent-500 text-white shadow">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <ThinkingTrace steps={liveSteps} live />
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="relative z-10 border-t border-edge bg-surface px-5 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto max-w-5xl"
        >
          <div className="portal-glow flex items-end gap-2 rounded-2xl border-2 border-edge bg-surface p-2 transition-colors focus-within:border-brand-500">
            <label htmlFor="agent-input" className="sr-only">
              Message Saylani Intelligence
            </label>
            <textarea
              id="agent-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Ask about ${role === "admin" ? "campuses, students, trainers…" : "your students, batches, classes…"}`}
              className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
            {messages.length > 0 && (
              <button
                type="button"
                onClick={startNewConversation}
                aria-label="Start a new conversation"
                title="New conversation"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge text-ink-muted transition-all hover:scale-105 hover:border-brand-400 hover:text-brand-700"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            )}
            {canUseVoice && (
              <button
                type="button"
                onClick={openVoice}
                disabled={thinking}
                aria-label="Talk to the assistant"
                title="Voice mode"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge text-brand-700 transition-all enabled:hover:scale-105 enabled:hover:border-accent-400 enabled:hover:bg-accent-50 disabled:opacity-30"
              >
                <Mic className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-solid text-white transition-all enabled:hover:scale-105 disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-muted/80">
            {mode === "live"
              ? "Connected to Groq — live AI responses with real portal data."
              : mode === "mock"
                ? "Offline mode — live AI is temporarily unavailable, so the assistant can't answer or do data entry right now. Your dashboard data is unaffected. Please retry shortly."
                : "Agent ready — answers are grounded in your portal data."}
          </p>
        </form>
      </div>

      {/* ── Chat history panel ─────────────────────────────── */}
      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div
              key="history-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setHistoryOpen(false)}
              className="absolute inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
              aria-hidden
            />
            <motion.div
              key="history-panel"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 z-40 flex w-80 max-w-[85vw] flex-col border-r border-edge bg-surface shadow-2xl"
              role="dialog"
              aria-label="Chat history"
            >
              <div className="flex items-center justify-between gap-2 border-b border-edge px-4 py-3.5">
                <h2 className="font-display text-base text-ink-strong">Chat history</h2>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close chat history"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink-strong"
                >
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  startNewConversation();
                  setHistoryOpen(false);
                }}
                className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-dashed border-brand-300 px-3.5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50"
              >
                <PlusCircle className="h-4 w-4" aria-hidden />
                New conversation
              </button>

              <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
                {historyLoading ? (
                  <p className="px-2 py-6 text-center text-sm text-ink-muted">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-ink-muted">
                    No previous conversations yet — your chats will show up here.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {history.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => resumeConversation(c.id)}
                          disabled={resumingId !== null}
                          className={cn(
                            "w-full rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                            c.id === conversationId
                              ? "bg-brand-50 text-brand-800"
                              : "text-ink hover:bg-surface-muted",
                          )}
                        >
                          <p className="truncate text-sm font-semibold">{c.title}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {timeAgo(c.updatedAt)} · {c.messageCount} message{c.messageCount === 1 ? "" : "s"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Voice mode overlay ─────────────────────────────── */}
      <AnimatePresence>
        {voiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface/95 px-6 backdrop-blur-sm"
            role="dialog"
            aria-label="Voice assistant"
          >
            <button
              type="button"
              onClick={closeVoice}
              aria-label="Close voice mode"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:border-red-300 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>

            {/* Language toggle */}
            <div className="absolute left-4 top-4 flex gap-1 rounded-full border border-edge bg-surface p-1">
              {(["en-US", "ur-PK"] as VoiceLang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => voice.changeLang(l)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    voice.lang === l ? "bg-brand-solid text-white" : "text-ink-muted hover:text-ink-strong",
                  )}
                >
                  {l === "en-US" ? "English" : "اردو"}
                </button>
              ))}
            </div>

            {/* Orb */}
            <button
              type="button"
              onClick={voice.interrupt}
              aria-label={voice.status === "speaking" ? "Tap to interrupt" : "Voice assistant status"}
              className="relative flex h-40 w-40 items-center justify-center"
            >
              {/* outer pulse rings */}
              {(voice.status === "listening" || voice.status === "speaking") && (
                <>
                  <motion.span
                    aria-hidden
                    animate={{ scale: [1, 1.45], opacity: [0.35, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    className={cn(
                      "absolute inset-0 rounded-full",
                      voice.status === "listening" ? "bg-accent-400" : "bg-brand-400",
                    )}
                  />
                  <motion.span
                    aria-hidden
                    animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                    className={cn(
                      "absolute inset-2 rounded-full",
                      voice.status === "listening" ? "bg-accent-300" : "bg-brand-300",
                    )}
                  />
                </>
              )}
              <motion.span
                aria-hidden
                animate={
                  voice.status === "thinking"
                    ? { rotate: 360, scale: [1, 1.05, 1] }
                    : voice.status === "speaking"
                      ? { scale: [1, 1.08, 1] }
                      : { scale: [1, 1.04, 1] }
                }
                transition={
                  voice.status === "thinking"
                    ? { rotate: { duration: 2.4, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }
                    : { duration: voice.status === "speaking" ? 0.5 : 1.6, repeat: Infinity, ease: "easeInOut" }
                }
                className={cn(
                  "flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-2xl",
                  voice.status === "listening"
                    ? "from-accent-500 to-accent-600 shadow-accent-500/40"
                    : "from-brand-solid to-accent-500 shadow-brand-600/40",
                )}
              >
                <Mic className="h-10 w-10" aria-hidden />
              </motion.span>
            </button>

            {/* Status + transcript */}
            <p className="mt-8 font-display text-2xl text-ink-strong" aria-live="polite">
              {voice.error
                ? "Microphone problem"
                : voice.status === "listening"
                  ? "Listening — boliye…"
                  : voice.status === "thinking"
                    ? "Thinking…"
                    : voice.status === "speaking"
                      ? "Speaking — tap the orb to interrupt"
                      : "Starting…"}
            </p>
            <p className="mt-3 min-h-[3rem] max-w-md text-center text-sm leading-relaxed text-ink-muted">
              {voice.error ??
                (voice.transcript ||
                  (voice.status === "listening"
                    ? "Ask anything, or dictate a new record — same powers as the chat."
                    : ""))}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * How assistant markdown maps onto the portal's own type and color tokens.
 * Defined once at module scope so the object identity is stable across
 * renders — react-markdown re-walks the tree whenever it changes.
 *
 * Text keeps the ink tokens throughout; brand color is spent only on the
 * things that are genuinely interactive or structural (links, list markers,
 * the heading rule), so a long answer stays calm rather than stripey.
 */
const MARKDOWN: Components = {
  // The bubble is already a small container — h1/h2/h3 all land on one
  // heading size, separated from what precedes them by a hairline rule.
  h1: ({ children }) => <Heading>{children}</Heading>,
  h2: ({ children }) => <Heading>{children}</Heading>,
  h3: ({ children }) => <Heading>{children}</Heading>,
  h4: ({ children }) => (
    <p className="mt-3 font-semibold text-ink first:mt-0">{children}</p>
  ),

  p: ({ children }) => <p className="mt-2.5 first:mt-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink-strong">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  ul: ({ children }) => (
    <ul className="mt-2.5 ml-1 list-disc space-y-1.5 pl-4 marker:text-brand-700 first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2.5 ml-1 list-decimal space-y-1.5 pl-4 marker:font-semibold marker:text-brand-700 first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,

  // Data tables are the whole point of a reporting assistant: numbers get
  // tabular figures so columns line up, and the table scrolls inside its own
  // box so a wide result never widens the chat.
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto rounded-xl border border-edge first:mt-0">
      <table className="w-full border-collapse text-left text-xs tabular-nums">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-edge">{children}</tbody>,
  // `style` carries GFM's column alignment (|---:| for numbers) — pass it
  // through or every column silently falls back to left-aligned.
  th: ({ children, style }) => (
    <th
      style={style}
      className="whitespace-nowrap border-b border-edge px-3 py-2 font-semibold text-ink"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top text-ink">
      {children}
    </td>
  ),

  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-edge bg-surface p-3 text-xs leading-relaxed first:mt-0 [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-ink">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded-md border border-edge bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-brand-800">
      {children}
    </code>
  ),

  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-2 border-brand-200 pl-3 text-ink-muted first:mt-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-edge" />,
  a: ({ href, children }) => <SmartLink href={href}>{children}</SmartLink>,
};

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-4 border-t border-edge pt-3 font-display text-[0.95rem] leading-snug text-ink-strong first:mt-0 first:border-0 first:pt-0">
      {children}
    </h3>
  );
}

/** A generate_word_report .docx URL becomes a download chip; everything else
 *  is an ordinary link. */
function SmartLink({ href, children }: { href?: string; children: ReactNode }) {
  if (href && /\.docx(\?|$)/i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-100"
      >
        <Download className="h-4 w-4" aria-hidden />
        Download Word Document
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words text-brand-700 underline underline-offset-2 hover:text-brand-800"
    >
      {children}
    </a>
  );
}

/**
 * Models like to bold a table's whole header row — `| **Campus | Students |
 * Trainers** |`. Markdown emphasis can't span cells, so those asterisks reach
 * the page literally. Cells are styled by MARKDOWN above and need no emphasis
 * of their own, so strip `**` from table rows (never from fenced code, where
 * asterisks are content).
 */
function normalizeMarkdown(md: string): string {
  let inFence = false;
  return md
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) inFence = !inFence;
      if (inFence || !line.trimStart().startsWith("|")) return line;
      return line.replace(/\*\*/g, "");
    })
    .join("\n");
}

/** Renders the assistant's markdown. Raw HTML in the model's output is NOT
 *  parsed — react-markdown ignores it by default, which is what we want for
 *  text that ultimately traces back to database rows. */
function MessageBody({ content }: { content: string }) {
  return (
    // remark-breaks keeps a lone newline as a line break. The model writes
    // line-oriented answers; without it, standard Markdown would fold them
    // into one dense paragraph.
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MARKDOWN}>
      {normalizeMarkdown(content)}
    </ReactMarkdown>
  );
}
