import OpenAI from "openai";

// ── OpenAI client ───────────────────────────────────────────────────────────────

const rawKey = process.env.OPENAI_API_KEY ?? "";
const openaiKey = rawKey.replace(/\s/g, "").trim();
export const openai =
  openaiKey.length >= 20 && openaiKey.startsWith("sk-")
    ? new OpenAI({ apiKey: openaiKey })
    : null;
