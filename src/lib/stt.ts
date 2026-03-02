import OpenAI from "openai";
import { toFile } from "openai/uploads";

const rawKey = process.env.OPENAI_API_KEY ?? "";
const openaiKey = rawKey.replace(/\s/g, "").trim();

const openai =
  openaiKey.length >= 20 && openaiKey.startsWith("sk-")
    ? new OpenAI({ apiKey: openaiKey })
    : null;

function inferExtension(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("webm")) return "webm";
  return "ogg";
}

export async function transcribeVoiceMessage(
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  if (!openai) return null;
  try {
    const ext = inferExtension(mimeType);
    const file = await toFile(buffer, `voice.${ext}`, {
      type: mimeType || "audio/ogg",
    });

    const model = process.env.OPENAI_STT_MODEL?.trim() || "whisper-1";
    const result = await openai.audio.transcriptions.create({
      model,
      file,
      language: "tr",
      response_format: "text",
    });

    if (typeof result === "string") return result.trim() || null;
    const text = (result as { text?: string }).text;
    return text?.trim() || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stt] transcription error:", msg);
    return null;
  }
}
