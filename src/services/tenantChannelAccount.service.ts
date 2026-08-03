/**
 * Kanal hesap defteri okuması ("anahtarlık").
 *
 * WhatsApp bugün tek ortak numaradan çalışıyor: hiçbir tenant'ın kendi kaydı
 * yok, bu yüzden buradaki tüm aramalar ıskalar ve çağıran taraf ortak numaraya
 * düşer. Amaç, işletme kendi numarasını/hesabını bağlamak istediğinde
 * gönderim ve yönlendirme yollarının hazır olması.
 *
 * Tablo (migration 046) henüz uygulanmadıysa sistem bozulmaz: eksik tablo bir
 * kez tespit edilir, sonrasında sorgu atılmaz ve her arama ıskalar.
 */
import { supabase } from "@/lib/supabase";
import { decryptChannelToken } from "@/lib/channel-tokens";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { logger } from "@/lib/logger";

export type ChannelKind = "whatsapp" | "instagram";

export type ChannelAccountStatus =
  | "active"
  | "disconnected"
  | "token_expired"
  | "revoked"
  | "needs_control";

export interface TenantChannelAccount {
  id: string;
  tenantId: string;
  channel: ChannelKind;
  externalAccountId: string;
  accountHandle: string | null;
  status: ChannelAccountStatus;
  tokenExpiresAt: string | null;
  /** Çözülmüş token. Şifre çözülemezse null — asla düz metin saklanmaz. */
  accessToken: string | null;
}

const CACHE_TTL_MS = 60_000;

/** null değer = "kayıt yok" (negatif önbellek). Ortak numarada olağan durum. */
const byTenantCache = new Map<
  string,
  { expiry: number; value: TenantChannelAccount | null }
>();
const byExternalIdCache = new Map<
  string,
  { expiry: number; value: TenantChannelAccount | null }
>();

/** Tablo yoksa (migration uygulanmadı) tekrar tekrar sorgulamayı bırak. */
let schemaAvailable: boolean | null = null;

type AccountRow = {
  id: string;
  tenant_id: string;
  channel: string;
  external_account_id: string;
  account_handle: string | null;
  status: string;
  token_expires_at: string | null;
  access_token_encrypted: string | null;
};

function mapRow(row: AccountRow): TenantChannelAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    channel: row.channel as ChannelKind,
    externalAccountId: row.external_account_id,
    accountHandle: row.account_handle,
    status: row.status as ChannelAccountStatus,
    tokenExpiresAt: row.token_expires_at,
    accessToken: decryptChannelToken(row.access_token_encrypted),
  };
}

const SELECT_COLUMNS =
  "id, tenant_id, channel, external_account_id, account_handle, status, token_expires_at, access_token_encrypted";

/** Eksik tablo hatasını yut, gerçek hatayı logla. Her iki durumda da null dön. */
function handleQueryError(scope: string, error: { message?: string | null }): null {
  const missing = extractMissingSchemaTable(error);
  if (missing === "tenant_channel_accounts") {
    schemaAvailable = false;
    logger.warn(
      `[channel-accounts] tenant_channel_accounts tablosu yok (migration 046). ${scope} ortak numaraya düşüyor.`
    );
    return null;
  }
  logger.error(`[channel-accounts] ${scope} sorgu hatası: ${error.message || "bilinmeyen"}`);
  return null;
}

function cacheGet(
  cache: Map<string, { expiry: number; value: TenantChannelAccount | null }>,
  key: string
): { hit: true; value: TenantChannelAccount | null } | { hit: false } {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return { hit: true, value: entry.value };
  if (entry) cache.delete(key);
  return { hit: false };
}

function cacheSet(
  cache: Map<string, { expiry: number; value: TenantChannelAccount | null }>,
  key: string,
  value: TenantChannelAccount | null
): void {
  cache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * İşletmenin kanal hesabı — durumu ne olursa olsun döner.
 *
 * Kaydın var olması ile kullanılabilir olması ayrı şeylerdir: çağıran taraf
 * `status`'e bakmalı. Bu ayrım, "hesap yok" ile "hesabın tokeni düşmüş"
 * durumlarını birbirine karıştırmamak için gerekli — ikincisi sessizce
 * ortak numaraya düşülecek bir arıza, birincisi normal durum.
 */
export async function getTenantChannelAccount(
  tenantId: string | null | undefined,
  channel: ChannelKind
): Promise<TenantChannelAccount | null> {
  if (!tenantId || schemaAvailable === false) return null;

  const cacheKey = `${tenantId}:${channel}`;
  const cached = cacheGet(byTenantCache, cacheKey);
  if (cached.hit) return cached.value;

  const { data, error } = await supabase
    .from("tenant_channel_accounts")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .maybeSingle();

  if (error) {
    handleQueryError("getTenantChannelAccount", error);
    return null;
  }

  schemaAvailable = true;
  const value = data ? mapRow(data as AccountRow) : null;
  cacheSet(byTenantCache, cacheKey, value);
  return value;
}

/**
 * Gelen mesajın ulaştığı hesaptan tenant'ı çözer — tahmin yok.
 *
 * WhatsApp'ta `metadata.phone_number_id`, Instagram'da alıcı hesap kimliği.
 * Ortak numarada kayıt bulunmaz (null döner) ve çağıran içerikten yönlendirmeye
 * devam eder.
 *
 * DİKKAT: Burada status'e göre filtreleme YAPILMAZ. Mesaj fiziksel olarak o
 * hesaba ulaştıysa sahibi bellidir; tokeni düşmüş bir hesabı elemek, o
 * işletmenin müşterilerini isim tahminine düşürür ve büyük olasılıkla
 * "hangi işletme?" sorusuna çarptırır. Kimin olduğunu bilmek her zaman
 * doğrudur; gönderim yapılıp yapılamayacağı ayrı bir karardır
 * (bkz. getTenantChannelAccount).
 */
export async function resolveTenantByChannelAccount(
  channel: ChannelKind,
  externalAccountId: string | null | undefined
): Promise<TenantChannelAccount | null> {
  const accountId = (externalAccountId || "").trim();
  if (!accountId || schemaAvailable === false) return null;

  const cacheKey = `${channel}:${accountId}`;
  const cached = cacheGet(byExternalIdCache, cacheKey);
  if (cached.hit) return cached.value;

  const { data, error } = await supabase
    .from("tenant_channel_accounts")
    .select(SELECT_COLUMNS)
    .eq("channel", channel)
    .eq("external_account_id", accountId)
    .maybeSingle();

  if (error) {
    handleQueryError("resolveTenantByChannelAccount", error);
    return null;
  }

  schemaAvailable = true;
  const value = data ? mapRow(data as AccountRow) : null;
  cacheSet(byExternalIdCache, cacheKey, value);
  return value;
}

/** Kayıt güncellendiğinde önbelleği düşür (bağlama/koparma akışları için). */
export function invalidateChannelAccountCache(
  tenantId?: string | null,
  channel?: ChannelKind
): void {
  if (!tenantId) {
    byTenantCache.clear();
    byExternalIdCache.clear();
    return;
  }
  if (channel) byTenantCache.delete(`${tenantId}:${channel}`);
  else for (const key of byTenantCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) byTenantCache.delete(key);
  }
  // Harici id eşlemesi tenant'a göre indekslenmediği için tümü düşürülür.
  byExternalIdCache.clear();
}
