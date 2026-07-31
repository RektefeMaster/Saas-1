import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRedisHealth, getWebhookDebugRecord } from "@/lib/redis";
import { getWhatsAppPhoneProfileSummary } from "@/lib/whatsapp";
import { openai } from "@/lib/bot-v1/conversation/client";
import { MODEL_SIMPLE } from "@/lib/bot-v1/conversation/constants";
import { TOOLS } from "@/lib/bot-v1/conversation/tools/definitions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Uçtan uca kurulum teşhisi.
 *
 * "Mesaj atıyorum, bot cevap vermiyor" sorununun tek tek denenerek çözülmesi
 * çok uzun sürüyor. Bu uç, zincirin her halkasını gerçekten deneyip nerede
 * koptuğunu Türkçe olarak söyler. Sırlar asla döndürülmez; yalnızca "tanımlı /
 * tanımsız" bilgisi verilir.
 *
 * Erişim: /admin oturumu (proxy.ts /api/admin/* yolunu zaten koruyor).
 */

type Check = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  fix?: string;
};

function envSet(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // ── 1) Zorunlu ortam değişkenleri ────────────────────────────────────────
  const requiredEnv: Array<{ name: string; why: string }> = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", why: "Veritabanı adresi" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", why: "Veritabanı erişimi" },
    { name: "OPENAI_API_KEY", why: "Bot cevap üretemez" },
    { name: "WHATSAPP_PHONE_NUMBER_ID", why: "Mesaj gönderilemez" },
    { name: "WHATSAPP_ACCESS_TOKEN", why: "Mesaj gönderilemez" },
    { name: "WHATSAPP_VERIFY_TOKEN", why: "Meta webhook doğrulaması yapılamaz" },
    { name: "WHATSAPP_WEBHOOK_SECRET", why: "Gelen webhook imzası doğrulanamaz (503)" },
    { name: "UPSTASH_REDIS_REST_URL", why: "Oturum hafızası ve tekilleştirme çalışmaz" },
    { name: "UPSTASH_REDIS_REST_TOKEN", why: "Oturum hafızası ve tekilleştirme çalışmaz" },
  ];
  const missingEnv = requiredEnv.filter((e) => !envSet(e.name));
  add({
    id: "env",
    label: "Ortam değişkenleri",
    ok: missingEnv.length === 0,
    detail:
      missingEnv.length === 0
        ? "Hepsi tanımlı"
        : `Eksik: ${missingEnv.map((e) => `${e.name} (${e.why})`).join(", ")}`,
    fix:
      missingEnv.length === 0
        ? undefined
        : "Vercel → Settings → Environment Variables → Production'a ekleyip REDEPLOY et.",
  });

  // ── 2) Redis ─────────────────────────────────────────────────────────────
  const redis = await getRedisHealth();
  add({
    id: "redis",
    label: "Redis (Upstash)",
    ok: redis.reachable,
    detail: redis.reachable
      ? `Bağlı, ${redis.latencyMs}ms`
      : redis.error || "Bağlanılamadı",
    fix: redis.reachable
      ? undefined
      : "Upstash konsolunda veritabanı açık mı bak. Token READONLY olmamalı — UPSTASH_REDIS_REST_TOKEN (readonly olan değil) kullanılmalı.",
  });

  // ── 3) Veritabanı + en az bir aktif işletme ──────────────────────────────
  let tenantCount = 0;
  let tenantNames: string[] = [];
  let dbOk = false;
  let dbDetail = "";
  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, status")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(10);
    if (error) {
      dbDetail = error.message;
    } else {
      dbOk = true;
      tenantCount = (data || []).length;
      tenantNames = (data || []).map((t) => String(t.name));
    }
  } catch (err) {
    dbDetail = err instanceof Error ? err.message : String(err);
  }
  add({
    id: "database",
    label: "Veritabanı bağlantısı",
    ok: dbOk,
    detail: dbOk ? "Bağlı" : dbDetail,
  });
  add({
    id: "tenant",
    label: "Aktif işletme",
    ok: dbOk && tenantCount > 0,
    detail: dbOk
      ? tenantCount > 0
        ? `${tenantCount} aktif işletme: ${tenantNames.join(", ")}`
        : "Hiç aktif işletme yok"
      : "Kontrol edilemedi",
    fix:
      dbOk && tenantCount === 0
        ? "/admin/tenants/new adresinden bir işletme oluştur. İşletme yoksa bot 'hangi işletme için?' deyip takılır."
        : undefined,
  });

  // ── 4) İşletme tipinde bot_config var mı ─────────────────────────────────
  let botConfigOk = false;
  let botConfigDetail = "";
  try {
    const { data, error } = await supabase
      .from("business_types")
      .select("slug, bot_config")
      .not("bot_config", "is", null)
      .limit(5);
    if (error) {
      botConfigDetail = error.message;
    } else {
      botConfigOk = (data || []).length > 0;
      botConfigDetail = botConfigOk
        ? `bot_config tanımlı tip sayısı: ${(data || []).length}`
        : "Hiçbir işletme tipinde bot_config yok";
    }
  } catch (err) {
    botConfigDetail = err instanceof Error ? err.message : String(err);
  }
  add({
    id: "bot_config",
    label: "İşletme tipi bot ayarı",
    ok: botConfigOk,
    detail: botConfigDetail,
    fix: botConfigOk
      ? undefined
      : "supabase/migrations/008_bot_config.sql çalıştırılmamış olabilir.",
  });

  // ── 5) WhatsApp kimlik bilgileri gerçekten geçerli mi ────────────────────
  let waOk = false;
  let waDetail = "";
  let waFix: string | undefined;
  try {
    const profile = await getWhatsAppPhoneProfileSummary();
    if (!profile) {
      waDetail = "Meta'ya bağlanılamadı veya kimlik bilgileri geçersiz";
      waFix =
        "WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN değerlerini Meta → WhatsApp → API Setup ekranındakiyle karşılaştır. Geçici token 24 saatte biter.";
    } else {
      waOk = true;
      waDetail = `Numara: ${profile.displayPhoneNumber ?? "?"} · İsim: ${
        profile.verifiedName ?? "?"
      } · Durum: ${profile.status ?? "?"}${
        profile.isTestNumber ? " · TEST NUMARASI" : ""
      }`;
      if (profile.isTestNumber) {
        waFix =
          "Test numarasında müşteri size ilk mesajı ATAMAZ. Konuşmayı Meta panelinden siz başlatıp gelen mesaja cevap vermelisiniz. Gerçek kullanım için kendi numaranızı kaydedin.";
      }
    }
  } catch (err) {
    waDetail = err instanceof Error ? err.message : String(err);
  }
  add({
    id: "whatsapp",
    label: "WhatsApp kimlik bilgileri",
    ok: waOk,
    detail: waDetail,
    fix: waFix,
  });

  // ── 6) Model gerçekten çalışıyor mu (tool'larla birlikte) ────────────────
  // En sinsi hata buradaydı: model tool + reasoning kombinasyonunu reddedince
  // her mesaj sessizce hataya düşüyordu.
  let modelOk = false;
  let modelDetail = "";
  let modelFix: string | undefined;
  if (!openai) {
    modelDetail = "OpenAI istemcisi kurulamadı (OPENAI_API_KEY eksik veya hatalı)";
  } else {
    try {
      const started = Date.now();
      const res = await openai.chat.completions.create({
        model: MODEL_SIMPLE,
        messages: [
          { role: "system", content: "Kısa cevap ver." },
          { role: "user", content: "Test. Sadece 'tamam' yaz." },
        ],
        tools: TOOLS,
        tool_choice: "auto",
        reasoning_effort: (process.env.OPENAI_REASONING_EFFORT?.trim() ||
          "none") as "none",
      });
      modelOk = Boolean(res.choices?.[0]?.message);
      modelDetail = `Model: ${MODEL_SIMPLE} · ${Date.now() - started}ms · yanıt alındı`;
    } catch (err) {
      const e = err as { status?: number; error?: { message?: string }; message?: string };
      modelDetail = `${e?.status ?? ""} ${e?.error?.message ?? e?.message ?? String(err)}`.trim();
      modelFix =
        "Model adı (OPENAI_CHAT_MODEL_SIMPLE) geçerli mi ve tool çağrısını destekliyor mu kontrol et. Hata reasoning_effort veya temperature diyorsa OPENAI_REASONING_EFFORT / OPENAI_TEMPERATURE ile ayarla.";
    }
  }
  add({
    id: "model",
    label: "Yapay zeka modeli (tool'larla)",
    ok: modelOk,
    detail: modelDetail,
    fix: modelFix,
  });

  // ── 7) Meta bize hiç ulaştı mı ───────────────────────────────────────────
  let ingressOk = false;
  let ingressDetail = "";
  let ingressFix: string | undefined;
  try {
    const record = await getWebhookDebugRecord();
    if (!record) {
      ingressDetail = "Meta'dan hiç webhook kaydı yok";
      ingressFix =
        "Meta → WhatsApp → Configuration: Callback URL doğru mu, 'messages' alanına abone olundu mu ve UYGULAMA YAYINLANDI MI (unpublished uygulamaya gerçek mesaj iletilmez) kontrol et.";
    } else {
      ingressOk = true;
      ingressDetail = `Son kayıt: ${record.stage ?? "?"} · ${record.at ?? "?"}`;
      if (typeof record.stage === "string" && record.stage.startsWith("rejected")) {
        ingressOk = false;
        ingressFix =
          record.stage === "rejected_missing_secret"
            ? "WHATSAPP_WEBHOOK_SECRET tanımlı değil."
            : "İmza doğrulanamadı: WHATSAPP_WEBHOOK_SECRET, Meta'daki App Secret ile birebir aynı olmalı.";
      }
    }
  } catch (err) {
    ingressDetail = err instanceof Error ? err.message : String(err);
  }
  add({
    id: "webhook_ingress",
    label: "Meta'dan gelen webhook",
    ok: ingressOk,
    detail: ingressDetail,
    fix: ingressFix,
  });

  // ── 8) Boru hattının hangi halkasına kadar gelindi ───────────────────────
  // Bu üçü birlikte "mesaj nerede öldü" sorusunu kesin cevaplar:
  //   job yok            → Meta hiç teslim etmedi (veya imza reddedildi)
  //   job var, kayıt yok → Inngest worker hiç çalışmadı
  //   inbound var, outbound yok → worker işlerken düştü
  const pipeline: Record<string, unknown> = {};

  try {
    const { data } = await supabase
      .from("message_processing_jobs")
      .select("message_id, status, attempt_count, error_code, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    pipeline.webhook_kabul_edilen_mesajlar = data || [];
  } catch (err) {
    pipeline.webhook_kabul_edilen_mesajlar = `okunamadı: ${
      err instanceof Error ? err.message : String(err)
    }`;
  }

  try {
    const { data } = await supabase
      .from("conversation_messages")
      .select("direction, stage, message_type, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    pipeline.son_konusma_kayitlari = data || [];
  } catch (err) {
    pipeline.son_konusma_kayitlari = `okunamadı: ${
      err instanceof Error ? err.message : String(err)
    }`;
  }

  // ── 9) Son mesajlar nerede durdu ─────────────────────────────────────────
  let lastStages: Array<{ stage: string; at: string; direction: string }> = [];
  try {
    const { data } = await supabase
      .from("bot_message_audit")
      .select("stage, direction, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    lastStages = (data || []).map((r) => ({
      stage: String(r.stage),
      direction: String(r.direction),
      at: String(r.created_at),
    }));
  } catch {
    // tablo yoksa sorun değil
  }

  const failed = checks.filter((c) => !c.ok);

  return NextResponse.json(
    {
      ok: failed.length === 0,
      ozet:
        failed.length === 0
          ? "Tüm kontroller geçti. Bot cevap vermiyorsa sorun Meta tarafındaki yayın/abonelik ayarındadır."
          : `${failed.length} sorun bulundu — aşağıdaki 'sorunlar' listesine bak.`,
      sorunlar: failed.map((c) => ({
        kontrol: c.label,
        durum: c.detail,
        yapilacak: c.fix,
      })),
      kontroller: checks,
      boru_hatti: pipeline,
      son_mesaj_asamalari: lastStages,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
