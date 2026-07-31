/**
 * Tenant mesaj şablonlarını tek yerden çözer.
 *
 * Neden var: `business_types.bot_config.messages` ve panel Ayarlar ekranındaki
 * "Hatırlatma mesajı" alanı (`tenants.config_override.messages`) tanımlıydı ama
 * cron'lar kendi sabit metnini gönderiyordu. İşletme panelde mesajı değiştiriyor,
 * müşteriye giden metin değişmiyordu. Bu servis o kopukluğu kapatır.
 */

import { supabase } from "@/lib/supabase";
import { fillTemplate } from "@/services/configMerge.service";

export type TenantMessageKey =
  | "reminder_24h"
  | "reminder_1h"
  | "review_request"
  | "no_show"
  | "cancellation_by_tenant"
  | "cancellation_by_customer"
  | "waitlist_available";

export interface TenantMessageContext {
  tenantId: string;
  tenantName: string;
  /** business_types.bot_config.messages */
  businessTypeMessages: Record<string, unknown>;
  /** tenants.config_override.messages (öncelikli) */
  tenantMessages: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Verilen tenant id'leri için mesaj bağlamını tek turda yükler (cron batch dostu).
 * Şema eksikse boş şablonlarla döner; çağıran tarafta fallback metin kullanılır.
 */
export async function loadTenantMessageContexts(
  tenantIds: string[]
): Promise<Map<string, TenantMessageContext>> {
  const out = new Map<string, TenantMessageContext>();
  const ids = [...new Set(tenantIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, business_type_id, config_override")
    .in("id", ids);

  if (error || !tenants) {
    if (error) console.warn("[tenantMessages] tenant load failed:", error.message);
    return out;
  }

  const businessTypeIds = [
    ...new Set(
      tenants
        .map((t) => (typeof t.business_type_id === "string" ? t.business_type_id : null))
        .filter((v): v is string => Boolean(v))
    ),
  ];

  const businessTypeMessages = new Map<string, Record<string, unknown>>();
  if (businessTypeIds.length > 0) {
    const { data: types, error: typeError } = await supabase
      .from("business_types")
      .select("id, bot_config")
      .in("id", businessTypeIds);
    if (typeError) {
      console.warn("[tenantMessages] business_type load failed:", typeError.message);
    }
    for (const row of types || []) {
      businessTypeMessages.set(
        String(row.id),
        asRecord(asRecord(row.bot_config).messages)
      );
    }
  }

  for (const tenant of tenants) {
    const configOverride = asRecord(tenant.config_override);
    out.set(String(tenant.id), {
      tenantId: String(tenant.id),
      tenantName: String(tenant.name || "İşletme"),
      businessTypeMessages:
        (typeof tenant.business_type_id === "string"
          ? businessTypeMessages.get(tenant.business_type_id)
          : undefined) || {},
      tenantMessages: asRecord(configOverride.messages),
    });
  }

  return out;
}

/**
 * Şablonu çözer ve placeholder'ları doldurur.
 * Tenant override > business_type > fallback sırasıyla bakar.
 * Şablon boş/geçersizse `fallback` döner; böylece hiçbir zaman boş mesaj gitmez.
 */
export function resolveTenantMessage(
  context: TenantMessageContext | undefined,
  key: TenantMessageKey,
  vars: Record<string, string>,
  fallback: string
): string {
  const candidates = [
    context?.tenantMessages?.[key],
    context?.businessTypeMessages?.[key],
  ];

  const fullVars = {
    ...vars,
    tenant_name: context?.tenantName ?? vars.tenant_name ?? "",
    "işletme_adınız": context?.tenantName ?? vars.tenant_name ?? "",
  };

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const filled = fillTemplate(candidate, fullVars).trim();
    if (filled) return filled;
  }

  return fillTemplate(fallback, fullVars).trim();
}
