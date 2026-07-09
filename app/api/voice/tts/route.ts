import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";

/**
 * ElevenLabs text-to-speech proxy for the voice assistant.
 *
 * Keeps the API key server-side and gates usage behind the same roles as
 * the chat agent. Returns MP3 audio; the client falls back to browser TTS
 * when this responds 503 (no key configured) or errors.
 */
const ELEVEN_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// "Rachel" — natural multilingual default; override with ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
// Flash v2.5: lowest latency, cheapest, supports Urdu + English.
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";
const MAX_TTS_CHARS = 2_000;

export async function POST(req: Request) {
  const session = await getSessionUser(req);
  if (!session || (session.role !== "admin" && session.role !== "trainer")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }

  let text: string;
  try {
    const body = await req.json();
    text = String(body.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  if (text.length > MAX_TTS_CHARS) text = `${text.slice(0, MAX_TTS_CHARS)}…`;

  const res = await fetch(`${ELEVEN_URL}/${VOICE_ID}/stream?output_format=mp3_22050_32`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.05 },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = (await res.text()).slice(0, 200);
    console.warn(`[api/voice/tts] ElevenLabs ${res.status}: ${detail}`);
    // 503 tells the client to fall back to browser TTS.
    return NextResponse.json({ error: "TTS unavailable" }, { status: 503 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
