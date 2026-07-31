import { NextRequest, NextResponse } from "next/server";
import { resolveWhatsAppCredentials } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v22.0";

/**
 * WhatsApp Business Account (WABA) → uygulama aboneliği kontrolü ve onarımı.
 *
 * Sık atlanan adım: Webhook'ta "messages" alanını işaretlemek TEK BAŞINA yetmez.
 * WABA'nın da uygulamaya abone edilmiş olması gerekir. Yeni bir uygulama
 * oluşturulduğunda bu bağ kopuk kalır ve Meta hiçbir mesajı teslim etmez —
 * sunucu tarafında hiçbir iz bırakmadan.
 *
 * GET  → mevcut abonelikleri listeler (salt okunur)
 * POST → uygulamayı WABA'ya abone eder (idempotent)
 */

async function readWabaId(request: NextRequest): Promise<string | null> {
  const fromQuery = request.nextUrl.searchParams.get("waba_id")?.trim();
  if (fromQuery) return fromQuery;
  const fromEnv = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (fromEnv) return fromEnv;

  // Son çare: telefon numarası ID'sinden WABA'yı keşfetmeyi dene.
  const { phoneId, token } = await resolveWhatsAppCredentials();
  if (!phoneId || !token) return null;
  try {
    const res = await fetch(
      `${GRAPH}/${phoneId}?fields=whatsapp_business_account{id}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    const payload = (await res.json().catch(() => ({}))) as {
      whatsapp_business_account?: { id?: string };
    };
    return payload.whatsapp_business_account?.id ?? null;
  } catch {
    return null;
  }
}

function missingWabaResponse() {
  return NextResponse.json(
    {
      ok: false,
      hata: "WhatsApp Business Account ID bulunamadı.",
      yapilacak:
        "Meta → WhatsApp → Step 1. Try it out ekranındaki 'WhatsApp Business Account ID' değerini WHATSAPP_BUSINESS_ACCOUNT_ID olarak Vercel'e ekle ve redeploy et. Ya da bu adrese ?waba_id=... ekleyerek dene.",
    },
    { status: 400 }
  );
}

export async function GET(request: NextRequest) {
  // Tarayıcıdan POST atmak zor olduğu için açık niyet belirten bir parametreyle
  // aboneliği buradan da yapılabilir kıldık. İşlem idempotent ve geri alınabilir.
  if (request.nextUrl.searchParams.get("subscribe") === "1") {
    return POST(request);
  }

  const { phoneId, token } = await resolveWhatsAppCredentials();
  if (!phoneId || !token) {
    return NextResponse.json(
      { ok: false, hata: "WhatsApp kimlik bilgileri tanımlı değil." },
      { status: 400 }
    );
  }

  const wabaId = await readWabaId(request);
  if (!wabaId) return missingWabaResponse();

  try {
    const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      data?: Array<{ whatsapp_business_api_data?: { id?: string; name?: string } }>;
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          waba_id: wabaId,
          hata: payload.error?.message ?? `Graph API ${res.status}`,
          yapilacak:
            "Token'ın whatsapp_business_management izni var mı ve System User bu WABA'ya erişebiliyor mu kontrol et.",
        },
        { status: 502 }
      );
    }

    const apps = (payload.data || []).map((row) => ({
      id: row.whatsapp_business_api_data?.id ?? null,
      name: row.whatsapp_business_api_data?.name ?? null,
    }));

    return NextResponse.json({
      ok: apps.length > 0,
      waba_id: wabaId,
      abone_uygulamalar: apps,
      ozet:
        apps.length > 0
          ? `WABA ${apps.length} uygulamaya abone. Mesajlar bu uygulamalara teslim edilir.`
          : "WABA hiçbir uygulamaya abone DEĞİL. Meta bu yüzden hiçbir mesajı teslim etmiyor.",
      yapilacak:
        apps.length > 0
          ? "Listede senin uygulaman (SaaS1) yoksa POST ile abone et."
          : "Bu adrese POST isteği göndererek abone et (aşağıdaki komut).",
      duzeltme_baglantisi: `${
        process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aiahi.net"
      }/api/admin/tools/whatsapp-subscription?subscribe=1`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, hata: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { phoneId, token } = await resolveWhatsAppCredentials();
  if (!phoneId || !token) {
    return NextResponse.json(
      { ok: false, hata: "WhatsApp kimlik bilgileri tanımlı değil." },
      { status: 400 }
    );
  }

  const wabaId = await readWabaId(request);
  if (!wabaId) return missingWabaResponse();

  try {
    const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string };
    };

    if (!res.ok || payload.success === false) {
      return NextResponse.json(
        {
          ok: false,
          waba_id: wabaId,
          hata: payload.error?.message ?? `Graph API ${res.status}`,
          yapilacak:
            "Token'ın whatsapp_business_management izni gerekiyor. System User'a WABA üzerinde tam yetki verildiğinden emin ol.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      waba_id: wabaId,
      ozet:
        "Uygulama WABA'ya abone edildi. Artık gelen mesajlar webhook'una teslim edilmeli.",
      sonraki_adim:
        "Telefonundan bir mesaj gönder, ardından /api/admin/tools/selftest çıktısındaki boru_hatti bölümüne bak.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, hata: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
