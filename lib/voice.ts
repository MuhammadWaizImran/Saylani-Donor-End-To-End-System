"use client";

/**
 * Voice engine for the AI assistant — browser-native, no extra API cost.
 *
 * Speech-to-text: Web Speech API (SpeechRecognition) — Chrome/Edge/Safari.
 * Text-to-speech: speechSynthesis.
 *
 * The hook runs a hands-free conversation loop:
 *   listen → final transcript → onUtterance(text) [the SAME chat pipeline
 *   the typed assistant uses] → speak the reply → listen again …
 * until stop() is called. Tapping while it speaks interrupts (barge-in).
 */
import { useEffect, useRef, useState } from "react";

export type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";
export type VoiceLang = "en-US" | "ur-PK";

/* ── minimal Web Speech typings (not in lib.dom for all TS configs) ── */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSupported(): boolean {
  return getRecognitionCtor() !== null && typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Once the TTS proxy says "not configured/out of quota", stop asking for a while. */
let elevenUnavailable = false;

/** Markdown → something a TTS voice can read naturally. */
function speakable(text: string): string {
  return text
    .replace(/\[\[OFFER_DOCUMENT\]\]/g, "")
    .replace(/```[\s\S]*?```/g, ". ")
    .replace(/\|/g, ", ")
    .replace(/[*_#`>]+/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/Rs\.\s?/g, "rupees ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split long replies into sentence-sized utterances (avoids Chrome's long-utterance stall). */
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + p).length > 220 && buf) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf += p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export interface UseVoiceOptions {
  /** Handle one user utterance; return the assistant's reply text (or null on failure). */
  onUtterance: (text: string) => Promise<string | null>;
}

export function useVoice({ onUtterance }: UseVoiceOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [lang, setLang] = useState<VoiceLang>("en-US");
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const langRef = useRef<VoiceLang>("en-US");
  const handlerRef = useRef(onUtterance);
  // Keep refs in sync after every render (ref writes are illegal mid-render).
  useEffect(() => {
    handlerRef.current = onUtterance;
    langRef.current = lang;
  });

  /** Premium path: ElevenLabs via our server proxy. Resolves true when it played. */
  const speakEleven = async (text: string): Promise<boolean> => {
    if (elevenUnavailable) return false;
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 503) {
        // No key configured / quota out — don't re-try every sentence.
        elevenUnavailable = true;
        return false;
      }
      if (!res.ok) return false;
      const url = URL.createObjectURL(await res.blob());
      return await new Promise<boolean>((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        const done = (ok: boolean) => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve(ok);
        };
        audio.onended = () => done(true);
        audio.onerror = () => done(false);
        audio.onpause = () => {
          // Interrupted (barge-in/stop) — count as finished.
          if (!audio.ended) done(true);
        };
        audio.play().catch(() => done(false));
      });
    } catch {
      return false;
    }
  };

  /** Fallback path: browser speechSynthesis. */
  const speakBrowser = (clean: string) =>
    new Promise<void>((resolve) => {
      const synth = window.speechSynthesis;
      synth.cancel();
      const parts = chunks(clean);
      const voices = synth.getVoices();
      // Prefer a natural English voice — replies are English/Roman Urdu.
      const preferred =
        voices.find((v) => v.lang === "en-US" && /natural|neural|online/i.test(v.name)) ??
        voices.find((v) => v.lang === "en-US") ??
        voices.find((v) => v.lang.startsWith("en"));
      let remaining = parts.length;
      for (const part of parts) {
        const u = new SpeechSynthesisUtterance(part);
        if (preferred) u.voice = preferred;
        u.rate = 1.04;
        u.pitch = 1;
        const done = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
        };
        u.onend = done;
        u.onerror = done;
        synth.speak(u);
      }
    });

  /** Speak `text`; resolves when done (or interrupted). */
  const speak = async (text: string): Promise<void> => {
    const clean = speakable(text);
    if (!clean) return;
    if (await speakEleven(clean)) return;
    await speakBrowser(clean);
  };

  const startListening = () => {
    if (!activeRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = langRef.current;
    rec.interimResults = true;
    rec.continuous = false;
    setStatus("listening");
    setTranscript("");

    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(finalText || interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access denied — allow the mic in your browser and try again.");
        activeRef.current = false;
        setStatus("idle");
      }
      // "no-speech"/"aborted" fall through to onend, which restarts.
    };
    rec.onend = async () => {
      if (!activeRef.current) return;
      const text = finalText.trim();
      if (!text) {
        // Heard nothing — keep listening.
        startListening();
        return;
      }
      setStatus("thinking");
      const reply = await handlerRef.current(text);
      if (!activeRef.current) return;
      if (reply) {
        setStatus("speaking");
        setTranscript("");
        await speak(reply);
      }
      if (activeRef.current) startListening();
    };

    try {
      rec.start();
    } catch {
      /* already started — ignore */
    }
  };

  const start = () => {
    if (activeRef.current) return;
    setError(null);
    activeRef.current = true;
    startListening();
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
  };

  const stop = () => {
    activeRef.current = false;
    recognitionRef.current?.abort();
    stopAudio();
    setStatus("idle");
    setTranscript("");
  };

  /** Barge-in: tap while it's speaking → cut TTS, listen immediately. */
  const interrupt = () => {
    if (!activeRef.current) return;
    stopAudio();
    if (status === "speaking") startListening();
  };

  const changeLang = (next: VoiceLang) => {
    setLang(next);
    langRef.current = next;
    // Applies from the next listening turn; restart if currently listening.
    if (activeRef.current && status === "listening") {
      recognitionRef.current?.abort();
    }
  };

  // Cleanup on unmount.
  useEffect(
    () => () => {
      activeRef.current = false;
      recognitionRef.current?.abort();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  return { status, transcript, lang, error, start, stop, interrupt, changeLang };
}
