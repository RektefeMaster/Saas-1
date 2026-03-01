import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";
import type { AdminTenantWizardPayload } from "@/types/dashboard-v2.types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json([]);
  }
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("business_type");

    let query = supabase
      .from("tenants")
      .select("*, business_types(id, name, slug)")
      .is("deleted_at", null)
      .order("name");

    if (status) query = query.eq("status", status);
    if (type) query = query.eq("business_type_id", type);

    const { data, error } = await query;
    if (error) {
      console.error("[tenants GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası";
    return NextResponse.json(
      { error: msg.includes("Supabase") ? "Supabase kurulumu gerekli. .env dosyasını kontrol edin." : msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Veritabanı bağlantısı yapılandırılmamış" },
      { status: 503 }
    );
  }
  const body = (await request.json()) as AdminTenantWizardPayload & {
    business_type_id?: string;
    name?: string;
    tenant_code?: string;
    email?: string;
    password?: string;
    status?: "active" | "inactive" | "suspended";
    config_override?: Record<string, unknown>;
  };
  const { business_type_id, name, tenant_code, email, password } = body;
  
  // Zorunlu alanları kontrol et
  if (!business_type_id || !name || !tenant_code) {
    return NextResponse.json(
      { error: "İşletme adı, tenant kodu ve işletme tipi gereklidir" },
      { status: 400 }
    );
  }

  // E-posta ve şifre kontrolü
  if (!email || !password) {
    return NextResponse.json(
      { error: "E-posta ve şifre gereklidir" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Şifre en az 6 karakter olmalıdır" },
      { status: 400 }
    );
  }

  const code = String(tenant_code).toUpperCase().trim();
  let userId: string | null = null;

  try {
    // 1) Auth kullanıcısı oluştur
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
    });

    if (authError) {
      // Eğer kullanıcı zaten varsa, mevcut kullanıcıyı bul
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists") || authError.message?.includes("User already registered")) {
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === email.trim());
        if (!existing) {
          return NextResponse.json(
            { error: "Bu e-posta zaten kayıtlı ancak kullanıcı bulunamadı. Lütfen farklı bir e-posta deneyin." },
            { status: 400 }
          );
        }
        userId = existing.id;
      } else {
        return NextResponse.json(
          { error: `Kullanıcı oluşturulamadı: ${authError.message}` },
          { status: 400 }
        );
      }
    } else {
      userId = userData?.user?.id || null;
      if (!userId) {
        return NextResponse.json(
          { error: "Kullanıcı oluşturuldu ancak kullanıcı ID alınamadı" },
          { status: 500 }
        );
      }
    }

    // 2) Bu kullanıcının zaten bir tenant'ı var mı kontrol et
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingTenant) {
      return NextResponse.json(
        { error: `Bu kullanıcı zaten "${(existingTenant as { name: string }).name}" adlı bir işletmeye bağlı` },
        { status: 400 }
      );
    }

    // 3) Tenant kodu benzersiz mi kontrol et
    const { data: existingCode } = await supabase
      .from("tenants")
      .select("id")
      .eq("tenant_code", code)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json(
        { error: `Bu tenant kodu (${code}) zaten kullanılıyor. Lütfen farklı bir kod deneyin.` },
        { status: 400 }
      );
    }

    // 4) Tenant oluştur
    const baseConfig = (body.config_override || {}) as Record<string, unknown>;
    const mergedConfig: Record<string, unknown> = { ...baseConfig };
    if (body.scheduling?.slot_duration_minutes !== undefined) {
      mergedConfig.slot_duration_minutes = body.scheduling.slot_duration_minutes;
    }
    if (body.scheduling?.advance_booking_days !== undefined) {
      mergedConfig.advance_booking_days = body.scheduling.advance_booking_days;
    }
    if (body.scheduling?.cancellation_hours !== undefined) {
      mergedConfig.cancellation_hours = body.scheduling.cancellation_hours;
    }
    if (body.pricing_preferences) {
      mergedConfig.pricing_preferences = body.pricing_preferences;
    }
    if (body.crm?.default_tags && body.crm.default_tags.length > 0) {
      mergedConfig.crm_default_tags = body.crm.default_tags;
    }
    if (body.crm?.reminder_channel) {
      mergedConfig.crm_reminder_channel = body.crm.reminder_channel;
    }

    const overrideContactPhone =
      typeof body.config_override?.contact_phone === "string"
        ? body.config_override.contact_phone.trim()
        : null;
    const overrideWorkingHours =
      typeof body.config_override?.working_hours_text === "string"
        ? body.config_override.working_hours_text.trim()
        : null;

    // 4) Tenant oluştur (eski şema ile uyumluluk: eksik kolonları otomatik düş)
    const tenantInsertPayload: Record<string, unknown> = {
      business_type_id,
      name: name.trim(),
      tenant_code: code,
      config_override: mergedConfig,
      status: body.status || "active",
      user_id: userId,
      owner_phone_e164: body.owner_phone_e164?.trim() || null,
      security_config: body.security_config || {},
      ui_preferences: body.ui_preferences || {},
      contact_phone: overrideContactPhone,
      working_hours_text: overrideWorkingHours,
    };
    const missingTenantColumns = new Set<string>();
    const tenantFallbackColumns = new Set([
      "owner_phone_e164",
      "security_config",
      "ui_preferences",
      "contact_phone",
      "working_hours_text",
    ]);
    let tenant: Record<string, unknown> | null = null;
    let tenantErr: { code?: string | null; message: string } | null = null;
    for (let i = 0; i < 6; i++) {
      const { data, error } = await supabase
        .from("tenants")
        .insert(tenantInsertPayload)
        .select()
        .single();
      if (!error) {
        tenant = (data ?? null) as unknown as Record<string, unknown>;
        tenantErr = null;
        break;
      }

      tenantErr = { code: error.code, message: error.message };
      const missing = extractMissingSchemaColumn(error);
      if (
        !missing ||
        missing.table !== "tenants" ||
        !tenantFallbackColumns.has(missing.column) ||
        !(missing.column in tenantInsertPayload)
      ) {
        break;
      }
      delete tenantInsertPayload[missing.column];
      missingTenantColumns.add(missing.column);
    }

    if (tenantErr) {
      if (tenantErr.code === "23505") {
        return NextResponse.json(
          { error: `Bu tenant kodu (${code}) zaten kullanılıyor. Lütfen farklı bir kod deneyin.` },
          { status: 400 }
        );
      }
      const missing = extractMissingSchemaColumn(tenantErr);
      if (missing?.table === "tenants") {
        return NextResponse.json(
          {
            error:
              `İşletme kaydedilemedi: veritabanı şeması güncel değil (eksik kolon: ${missing.column}). ` +
              "Supabase migration 010/011 çalıştırılmalı.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `İşletme kaydedilemedi: ${tenantErr.message}` },
        { status: 500 }
      );
    }
    if (!tenant) {
      return NextResponse.json({ error: "İşletme kaydedilemedi" }, { status: 500 });
    }

    // 5) Optional: çalışma saatleri
    if (body.scheduling?.weekly_slots && body.scheduling.weekly_slots.length > 0) {
      const slotsPayload = body.scheduling.weekly_slots
        .filter(
          (slot) =>
            typeof slot.day_of_week === "number" &&
            typeof slot.start_time === "string" &&
            typeof slot.end_time === "string"
        )
        .map((slot) => ({
          tenant_id: tenant.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }));

      if (slotsPayload.length > 0) {
        const { error: slotError } = await supabase
          .from("availability_slots")
          .upsert(slotsPayload, { onConflict: "tenant_id,day_of_week" });
        if (slotError) {
          return NextResponse.json(
            { error: `Çalışma saatleri kaydedilemedi: ${slotError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 6) Optional: kapalı günler
    if (body.scheduling?.blocked_dates && body.scheduling.blocked_dates.length > 0) {
      const blockedPayload = body.scheduling.blocked_dates
        .filter((row) => row.start_date && row.end_date)
        .map((row) => ({
          tenant_id: tenant.id,
          start_date: row.start_date,
          end_date: row.end_date,
          reason: row.reason?.trim() || null,
        }));
      if (blockedPayload.length > 0) {
        const { error: blockedError } = await supabase
          .from("blocked_dates")
          .insert(blockedPayload);
        if (blockedError) {
          return NextResponse.json(
            { error: `Kapalı günler kaydedilemedi: ${blockedError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 7) Optional: hizmetler
    if (body.services && body.services.length > 0) {
      let servicesPayload = body.services
        .filter((service) => service.name?.trim())
        .map((service, index) => ({
          tenant_id: tenant.id,
          name: service.name.trim(),
          slug: (service.slug?.trim() || slugify(service.name)).slice(0, 120),
          description: service.description?.trim() || null,
          price: typeof service.price === "number" ? service.price : null,
          duration_minutes:
            typeof service.duration_minutes === "number" && service.duration_minutes > 0
              ? service.duration_minutes
              : 30,
          is_active: service.is_active !== false,
          price_visible: service.price_visible !== false,
          display_order:
            typeof service.display_order === "number" && service.display_order >= 0
              ? service.display_order
              : index,
        }));
      if (servicesPayload.length > 0) {
        const serviceFallbackColumns = new Set([
          "duration_minutes",
          "is_active",
          "price_visible",
          "display_order",
        ]);
        let serviceError: { message: string } | null = null;
        for (let i = 0; i < 6; i++) {
          const { error } = await supabase.from("services").insert(servicesPayload);
          if (!error) {
            serviceError = null;
            break;
          }
          serviceError = { message: error.message };
          const missing = extractMissingSchemaColumn(error);
          if (
            !missing ||
            missing.table !== "services" ||
            !serviceFallbackColumns.has(missing.column)
          ) {
            break;
          }
          servicesPayload = servicesPayload.map((row) => {
            const next = { ...row };
            delete (next as Record<string, unknown>)[missing.column];
            return next;
          });
        }
        if (serviceError) {
          const missing = extractMissingSchemaColumn(serviceError);
          if (missing?.table === "services") {
            return NextResponse.json(
              {
                error:
                  `Hizmetler kaydedilemedi: veritabanı şeması güncel değil (eksik kolon: ${missing.column}). ` +
                  "Supabase migration 010/011 çalıştırılmalı.",
              },
              { status: 500 }
            );
          }
          return NextResponse.json(
            { error: `Hizmetler kaydedilemedi: ${serviceError.message}` },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      ...tenant,
      message: "İşletme ve kullanıcı başarıyla oluşturuldu",
      compatibility_warnings:
        missingTenantColumns.size > 0
          ? [
              `Eski şema nedeniyle bazı alanlar kayıt dışı bırakıldı: ${Array.from(
                missingTenantColumns
              ).join(", ")}`,
            ]
          : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[tenants POST]", err);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
