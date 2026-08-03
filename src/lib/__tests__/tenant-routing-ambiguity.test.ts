// @vitest-environment node
/**
 * Benzer isimli işletmelerde yönlendirme.
 *
 * Kritik davranış: iki işletmenin adı birbirine yakın puan aldığında bot
 * TAHMİN ETMEMELİ. Yanlış eşleşme, bir işletmenin müşteri konuşmasını başka
 * bir işletmenin paneline düşürür.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type TenantFixture = {
  id: string;
  name: string;
  status: string | null;
  tenant_code: string;
};

const TENANTS: TenantFixture[] = [
  // Aynı isimde iki işletme — gerçek hayatta olağan (farklı şubeler/şehirler).
  { id: "t1", name: "Kuaför Ahmet", status: "active", tenant_code: "AHMET01" },
  { id: "t2", name: "Kuaför Ahmet", status: "active", tenant_code: "AHMET02" },
  { id: "t3", name: "Oto Yıkama Yıldız", status: "active", tenant_code: "YILDIZ01" },
  { id: "t4", name: "Berber Mehmet", status: "active", tenant_code: "MEHMET01" },
];

/** Müşterinin randevu geçmişi: tenant_id listesi (en yeniden eskiye). */
let appointmentHistory: Array<{ tenant_id: string; updated_at: string }> = [];

/** Zincirlenebilir minimal Supabase taklidi: filtreleri toplar, sonda çözer. */
function createQuery(table: string) {
  const filters: Record<string, unknown> = {};

  const resolveRows = (): TenantFixture[] => {
    if (table !== "tenants") return [];
    if (filters.tenant_code) {
      return TENANTS.filter((t) => t.tenant_code === filters.tenant_code);
    }
    if (filters.id) return TENANTS.filter((t) => t.id === filters.id);
    return TENANTS;
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    },
    in: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => {
      const rows = resolveRows();
      return rows.length === 1
        ? { data: rows[0], error: null }
        : { data: null, error: { message: "not found" } };
    },
    maybeSingle: async () => {
      const rows = resolveRows();
      return { data: rows[0] ?? null, error: null };
    },
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({
        data: table === "appointments" ? appointmentHistory : resolveRows(),
        error: null,
      }),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => createQuery(table) },
  isSupabaseConfigured: () => true,
}));

const { resolveTenantRouting } = await import("@/lib/tenant-routing");

describe("resolveTenantRouting — benzer isimler", () => {
  beforeEach(() => {
    appointmentHistory = [];
  });

  it("aynı isimli iki işletmede tahmin etmez, belirsiz döner", async () => {
    const decision = await resolveTenantRouting({
      customerPhone: "+905551112233",
      rawMessage: "kuaför ahmet randevu almak istiyorum",
      previousTenantId: null,
    });

    expect(decision.reason).toBe("ambiguous");
    // En önemlisi: hiçbir işletmeye bağlanmadı.
    expect(decision.tenantId).toBeNull();
    expect(decision.candidates?.map((c) => c.id).sort()).toEqual(["t1", "t2"]);
    // Aday listesi seçilebilir olmalı: kod olmadan liste satırı üretilemez.
    expect(decision.candidates?.every((c) => c.tenantCode)).toBe(true);
  });

  it("belirsiz adaylardan biri müşterinin mevcut işletmesiyse ona devam eder", async () => {
    const decision = await resolveTenantRouting({
      customerPhone: "+905551112233",
      rawMessage: "kuaför ahmet",
      previousTenantId: "t2",
    });

    expect(decision.reason).toBe("session");
    expect(decision.tenantId).toBe("t2");
  });

  it("isim net olduğunda eskisi gibi doğrudan eşleştirir", async () => {
    const decision = await resolveTenantRouting({
      customerPhone: "+905551112233",
      rawMessage: "berber mehmet randevu",
      previousTenantId: null,
    });

    expect(decision.reason).toBe("name");
    expect(decision.tenantId).toBe("t4");
  });

  it("oturum düşmüşse randevu geçmişindeki tek adayla devam eder", async () => {
    // Redis eşlemesi yok (previousTenantId null) ama müşteri t1'den hizmet almış.
    appointmentHistory = [{ tenant_id: "t1", updated_at: "2026-08-01T10:00:00Z" }];

    const decision = await resolveTenantRouting({
      customerPhone: "+905551112233",
      rawMessage: "kuaför ahmet",
      previousTenantId: null,
    });

    expect(decision.reason).toBe("customer_history");
    expect(decision.tenantId).toBe("t1");
  });

  it("müşteri benzer isimli işletmelerin İKİSİNDEN de hizmet aldıysa yine sorar", async () => {
    appointmentHistory = [
      { tenant_id: "t2", updated_at: "2026-08-02T10:00:00Z" },
      { tenant_id: "t1", updated_at: "2026-08-01T10:00:00Z" },
    ];

    const decision = await resolveTenantRouting({
      customerPhone: "+905551112233",
      rawMessage: "kuaför ahmet",
      previousTenantId: null,
    });

    // En yeniyi seçmek bir tahmin olurdu — sormak doğrusu.
    expect(decision.reason).toBe("ambiguous");
    expect(decision.tenantId).toBeNull();
  });

  it("müşteri listeden seçtiğinde seçim isim tahminini geçersiz kılar", async () => {
    const decision = await resolveTenantRouting({
      customerPhone: "+905551112233",
      rawMessage: "Kuaför Ahmet",
      previousTenantId: null,
      tenantCodeHint: "AHMET02",
    });

    expect(decision.reason).toBe("marker");
    expect(decision.tenantId).toBe("t2");
  });
});
