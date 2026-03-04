import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("tenants")
    .select("*, business_types(*)")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    name,
    tenant_code,
    status,
    config_override,
    owner_username,
    owner_phone_e164,
    security_config,
    ui_preferences,
    campaign_enabled,
    subscription_end_at,
    subscription_plan,
    rate_limit_override,
    monthly_revenue,
  } = body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (tenant_code !== undefined) updates.tenant_code = String(tenant_code).toUpperCase();
  if (status !== undefined) updates.status = status;
  if (config_override !== undefined) updates.config_override = config_override;
  if (owner_username !== undefined) updates.owner_username = owner_username;
  if (owner_phone_e164 !== undefined) updates.owner_phone_e164 = owner_phone_e164;
  if (security_config !== undefined) updates.security_config = security_config;
  if (ui_preferences !== undefined) updates.ui_preferences = ui_preferences;
  if (campaign_enabled !== undefined) updates.campaign_enabled = Boolean(campaign_enabled);
  if (subscription_end_at !== undefined) updates.subscription_end_at = subscription_end_at;
  if (subscription_plan !== undefined) updates.subscription_plan = subscription_plan;
  if (rate_limit_override !== undefined) updates.rate_limit_override = rate_limit_override;
  if (monthly_revenue !== undefined) updates.monthly_revenue = monthly_revenue;

  const patchPayload = { ...updates };
  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;
  for (let i = 0; i < 6; i++) {
    const result = await supabase
      .from("tenants")
      .update(patchPayload)
      .eq("id", id)
      .select()
      .single();
    if (!result.error) {
      data = (result.data ?? null) as unknown as Record<string, unknown>;
      error = null;
      break;
    }
    error = { message: result.error.message };
    const missing = extractMissingSchemaColumn(result.error);
    if (!missing || missing.table !== "tenants" || !(missing.column in patchPayload)) break;
    delete patchPayload[missing.column];
  }
  if (error) {
    const missing = extractMissingSchemaColumn(error);
    if (missing?.table === "tenants") {
      return NextResponse.json(
        {
          error:
            `Güncelleme yapılamadı: veritabanı şeması güncel değil (eksik kolon: ${missing.column}). ` +
            "Supabase migration 010/011 çalıştırılmalı.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const soft = request.nextUrl.searchParams.get("soft") === "true";
  const purgeAuth = request.nextUrl.searchParams.get("purge_auth") !== "false";

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (tenantError) return NextResponse.json({ error: tenantError.message }, { status: 500 });
  if (!tenant) return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });

  if (soft) {
    const softPayload: Record<string, unknown> = {
      deleted_at: new Date().toISOString(),
      status: "inactive",
    };
    let softError: { message: string } | null = null;
    let data: Record<string, unknown> | null = null;
    for (let i = 0; i < 4; i++) {
      const result = await supabase
        .from("tenants")
        .update(softPayload)
        .eq("id", id)
        .select()
        .single();
      if (!result.error) {
        data = (result.data ?? null) as unknown as Record<string, unknown>;
        softError = null;
        break;
      }
      softError = { message: result.error.message };
      const missing = extractMissingSchemaColumn(result.error);
      if (!missing || missing.table !== "tenants" || !(missing.column in softPayload)) break;
      delete softPayload[missing.column];
    }
    if (softError) return NextResponse.json({ error: softError.message }, { status: 500 });
    return NextResponse.json(data);
  }

  let hasOtherTenantForUser = false;
  if (tenant.user_id) {
    let ownershipCheck = await supabase
      .from("tenants")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", tenant.user_id)
      .neq("id", id)
      .is("deleted_at", null);

    if (ownershipCheck.error) {
      const missing = extractMissingSchemaColumn(ownershipCheck.error);
      if (missing?.table === "tenants" && missing.column === "deleted_at") {
        ownershipCheck = await supabase
          .from("tenants")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", tenant.user_id)
          .neq("id", id);
      }
    }

    if (ownershipCheck.error) {
      return NextResponse.json({ error: ownershipCheck.error.message }, { status: 500 });
    }
    hasOtherTenantForUser = (ownershipCheck.count ?? 0) > 0;
  }

  // Hard delete: Veritabanından tamamen sil
  // Önce kaydın var olduğunu doğrula
  const { data: verifyTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!verifyTenant) {
    return NextResponse.json(
      { error: "İşletme bulunamadı (zaten silinmiş olabilir)" },
      { status: 404 }
    );
  }

  // DELETE işlemini gerçekleştir
  const { data: deletedData, error: deleteTenantError } = await supabase
    .from("tenants")
    .delete()
    .eq("id", id)
    .select();

  if (deleteTenantError) {
    console.error("Tenant DELETE hatası:", {
      id,
      error: deleteTenantError,
      message: deleteTenantError.message,
      details: deleteTenantError.details,
      hint: deleteTenantError.hint,
    });
    return NextResponse.json(
      { 
        error: `İşletme silinemedi: ${deleteTenantError.message}`,
        details: deleteTenantError.details,
        hint: deleteTenantError.hint,
      },
      { status: 500 }
    );
  }

  // Silme işleminin gerçekten gerçekleştiğini doğrula
  if (!deletedData || deletedData.length === 0) {
    // Eğer hiçbir satır silinmediyse, kayıt zaten yok olabilir veya başka bir sorun var
    // Bir saniye bekle ve tekrar kontrol et (trigger/constraint gecikmesi olabilir)
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const { data: checkData, error: checkError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    
    if (checkError) {
      console.error("Tenant silme doğrulama hatası:", checkError);
      // Hata olsa bile, DELETE işlemi başarılı sayılabilir
    } else if (checkData) {
      // Kayıt hala var, silme başarısız
      console.error("Tenant DELETE başarısız: Kayıt hala veritabanında", { 
        id, 
        checkData,
        deletedData,
      });
      return NextResponse.json(
        { 
          error: "İşletme silinemedi. Kayıt hala veritabanında mevcut. RLS politikaları veya constraint'ler silmeyi engelliyor olabilir.",
          tenant_id: id,
        },
        { status: 500 }
      );
    }
    // Kayıt yok, silme başarılı
  } else {
    // Silme başarılı, silinen kayıt sayısını logla
    console.log("Tenant başarıyla silindi:", { id, deleted_count: deletedData.length });
  }

  let authUserDeleted = false;
  let authDeleteWarning: string | null = null;
  if (purgeAuth && tenant.user_id && !hasOtherTenantForUser) {
    try {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(tenant.user_id);
      if (authDeleteError) {
        console.error("Auth user DELETE hatası:", authDeleteError);
        authDeleteWarning = authDeleteError.message;
      } else {
        authUserDeleted = true;
      }
    } catch (authError) {
      console.error("Auth user DELETE exception:", authError);
      authDeleteWarning = authError instanceof Error ? authError.message : "Bilinmeyen hata";
    }
  }

  return NextResponse.json({
    deleted: true,
    auth_user_deleted: authUserDeleted,
    auth_delete_warning: authDeleteWarning,
    deleted_count: deletedData?.length || 0,
  });
}
