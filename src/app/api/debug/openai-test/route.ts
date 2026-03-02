/**
 * OpenAI bağlantı testi. Tarayıcıdan aç: /api/debug/openai-test
 * Başarılıysa OpenAI çalışıyor; hata varsa tam mesajı döner (key, kota vb.)
 */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireDebugAccess } from "@/lib/debug-auth";

export async function GET() {
  const blocked = await requireDebugAccess();
  if (blocked) return blocked;

  const rawKey = process.env.OPENAI_API_KEY ?? "";
  const key = rawKey.replace(/\s/g, "").trim();
  const keyOk = key.length >= 20 && key.startsWith("sk-");

  if (!keyOk) {
    return NextResponse.json({
      ok: false,
      error: "OPENAI_API_KEY eksik veya geçersiz (sk- ile başlamalı, boşluksuz)",
      keyLength: rawKey.length,
      keyStartsWithSk: rawKey.trim().startsWith("sk-"),
    }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: key });

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Merhaba, tek kelime cevap ver: tamam" }],
      max_tokens: 10,
    });
    const text = res.choices[0]?.message?.content ?? "";
    return NextResponse.json({ ok: true, reply: text });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { message?: string; code?: string }; message?: string };
    const status = e?.status;
    const message = e?.error?.message ?? e?.message ?? String(err);
    return NextResponse.json({
      ok: false,
      status,
      message,
      hint: status === 401 ? "API key yanlış veya iptal edilmiş. platform.openai.com → API keys kontrol et." :
        status === 429 ? "Kota / limit aşıldı. platform.openai.com → Billing / Usage kontrol et." :
        status === 500 ? "OpenAI sunucu hatası, kısa süre sonra tekrar dene." : "Vercel env'de OPENAI_API_KEY doğru mu kontrol et.",
    }, { status: 200 });
  }
}
