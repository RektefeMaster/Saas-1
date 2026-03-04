import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";

// ── OpenAI client (Langfuse ile LLM gözlemi) ───────────────────────────────────

const rawKey = process.env.OPENAI_API_KEY ?? "";
const openaiKey = rawKey.replace(/\s/g, "").trim();
const langfuseSecret = process.env.LANGFUSE_SECRET_KEY?.trim();
const langfusePublic = process.env.LANGFUSE_PUBLIC_KEY?.trim();

const baseClient =
  openaiKey.length >= 20 && openaiKey.startsWith("sk-")
    ? new OpenAI({ apiKey: openaiKey })
    : null;

/** Langfuse yapılandırılmışsa otomatik tracing; yoksa ham client */
export const openai =
  baseClient && langfuseSecret && langfusePublic
    ? observeOpenAI(baseClient, {
        generationName: "ahi-ai-bot",
      })
    : baseClient;
