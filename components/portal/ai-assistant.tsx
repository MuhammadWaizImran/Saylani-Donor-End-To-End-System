"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  Download,
  FileText,
  MessageSquareText,
  Mic,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import type { UserRole } from "@/types/management";
import { AGENT_MODEL_LABEL, askAgent, type AgentMode, type ChatMessage } from "@/lib/ai/agent";
import { useSession } from "@/lib/auth";
import { useVoice, voiceSupported, type VoiceLang } from "@/lib/voice";
import { Avatar } from "@/components/portal/ui";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

const adminPrompts = [
  { title: "Executive summary", prompt: "Give me an executive summary of the whole organization." },
  { title: "Campus health", prompt: "Which campus needs attention right now?" },
  { title: "Placement stats", prompt: "Show me placement and salary stats." },
  { title: "Top trainers", prompt: "Who are my top performing trainers?" },
];

const trainerPrompts = [
  { title: "At-risk students", prompt: "Which of my students are at risk?" },
  { title: "My batches", prompt: "Summarize my batches and student progress." },
  { title: "Placement record", prompt: "Show my placement record." },
  { title: "Course status", prompt: "How are my courses progressing?" },
];

const timeFormatter = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

/** The agent prints this literal token when offering a document-vs-chat
 *  choice for a big analysis (see the BIG-ANALYSIS CONFIRMATION rule in
 *  app/api/chat/route.ts). Stripped from display/speech; its presence on
 *  the latest assistant message renders the choice buttons below. */
const OFFER_MARKER = "[[OFFER_DOCUMENT]]";

export function AiAssistant({ role }: { role: Extract<UserRole, "admin" | "trainer"> }) {
  const session = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

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
    try {
      const reply = await askAgent(history, {
        role,
        userName: session.name,
        userEmail: session.email,
      });
      setMode(reply.mode);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${++idCounter.current}-a`,
          role: "assistant",
          content: reply.content,
          createdAt: new Date().toISOString(),
        },
      ]);
      return reply.content;
    } finally {
      setThinking(false);
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
    <div className="relative flex h-[calc(100svh-190px)] min-h-[540px] flex-col overflow-hidden rounded-3xl border border-edge bg-white shadow-xl shadow-brand-950/5">
      {/* Chat header */}
      <div className="flex items-center justify-between gap-3 border-b border-edge bg-gradient-to-r from-brand-50 via-white to-accent-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-lg shadow-accent-500/25">
            <Sparkles className="h-5 w-5" aria-hidden />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                mode === "live" ? "bg-accent-500" : "bg-amber-400",
              )}
              aria-hidden
            />
          </span>
          <div>
            <h2 className="font-display text-xl leading-tight text-black">Saylani Intelligence</h2>
            <p className="text-xs text-ink-muted">
              Your {role === "admin" ? "operations" : "teaching"} copilot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-edge bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted sm:inline-flex">
            <Zap className="h-3.5 w-3.5 text-accent-600" aria-hidden />
            {AGENT_MODEL_LABEL}
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-700"
              aria-label="Start a new conversation"
              title="New conversation"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-xl shadow-accent-500/30"
            >
              <Sparkles className="h-7 w-7" aria-hidden />
            </motion.span>
            <h3 className="mt-6 font-display text-3xl text-black">
              Assalam-o-Alaikum, <em className="text-[#6F6F6F]">{userName.split(" ")[0]}</em>
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
              Ask me anything about {role === "admin" ? "campuses, students, trainers, courses, and placements" : "your students, batches, and placements"} — I&apos;ll pull the data for you instantly.
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
                  className="portal-glow group rounded-2xl border border-edge bg-white p-4 text-left transition-all hover:-translate-y-0.5"
                >
                  <p className="text-sm font-bold text-ink group-hover:text-brand-700">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{p.prompt}</p>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow">
                      <Bot className="h-4 w-4" aria-hidden />
                    </span>
                  ) : (
                    <Avatar name={userName} />
                  )}
                  <div className={cn("group min-w-0 max-w-[85%]", message.role === "user" ? "text-right" : "")}>
                    <div
                      className={cn(
                        "inline-block whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-sm leading-relaxed",
                        message.role === "user"
                          ? "rounded-tr-sm bg-brand-700 text-white"
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
                          className="inline-flex items-center gap-2 rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent-400 hover:bg-surface-muted disabled:opacity-50"
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
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-edge bg-surface-muted px-4 py-3.5">
                  <span className="sr-only">Assistant is thinking</span>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                      className="h-1.5 w-1.5 rounded-full bg-accent-600"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-edge bg-white px-5 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto max-w-3xl"
        >
          <div className="flex items-end gap-2 rounded-2xl border-2 border-edge bg-white p-2 shadow-sm transition-colors focus-within:border-brand-500">
            <label htmlFor="agent-input" className="sr-only">
              Message Saylani Intelligence
            </label>
            <textarea
              id="agent-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Ask about ${role === "admin" ? "campuses, placements, trainers…" : "your students, batches, placements…"}`}
              className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-all enabled:hover:scale-105 disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-muted/80">
            {mode === "live"
              ? "Connected to Groq — live AI responses with real portal data."
              : mode === "mock"
                ? "Offline mode — live AI is temporarily unavailable; answers computed directly from portal data. Data entry needs live AI, please retry shortly."
                : "Agent ready — answers are grounded in your portal data."}
          </p>
        </form>
      </div>

      {/* ── Voice mode overlay ─────────────────────────────── */}
      <AnimatePresence>
        {voiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 px-6 backdrop-blur-sm"
            role="dialog"
            aria-label="Voice assistant"
          >
            <button
              type="button"
              onClick={closeVoice}
              aria-label="Close voice mode"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:border-red-300 hover:text-red-600"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>

            {/* Language toggle */}
            <div className="absolute left-4 top-4 flex gap-1 rounded-full border border-edge bg-white p-1">
              {(["en-US", "ur-PK"] as VoiceLang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => voice.changeLang(l)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    voice.lang === l ? "bg-brand-700 text-white" : "text-ink-muted hover:text-black",
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
                    : "from-brand-600 to-accent-500 shadow-brand-600/40",
                )}
              >
                <Mic className="h-10 w-10" aria-hidden />
              </motion.span>
            </button>

            {/* Status + transcript */}
            <p className="mt-8 font-display text-2xl text-black" aria-live="polite">
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

const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
const IS_URL = /^https?:\/\//;

/** Renders assistant text with URLs turned into clickable links — a
 *  generate_word_report download link becomes a highlighted download chip. */
function MessageBody({ content }: { content: string }) {
  const parts = content.split(URL_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        if (!IS_URL.test(part)) {
          return <span key={i}>{part}</span>;
        }
        const isDocx = /\.docx(\?|$)/i.test(part);
        if (isDocx) {
          return (
            <a
              key={i}
              href={part}
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
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            {part}
          </a>
        );
      })}
    </>
  );
}
