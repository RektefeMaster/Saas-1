import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";
import { slugify } from "@/lib/slugify";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  isValidUsername,
  normalizeUsername,
  usernameToLoginEmail,
} from "@/lib/username-auth";
import { logTenantEvent } from "@/services/eventLog.service";

const FALLBACK_TENANT_COLUMNS = new Set([
  "owner_username",
  "owner_phone_e164",
  "security_config",
  "ui_preferences",
  "campaign_enabled",
  "subscription_plan",
]);

function sanitizeTenantCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function generateTenantCode(name: string): string {
  const base = sanitizeTenantCode(slugify(name, 18));
  const prefix = (base || "TENANT").slice(0, 8);
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}${suffix}`.slice(0, 12);
}

function generateUsername(name: string): string {
  const base = slugify(name, 24).replace(/-/g, "");
  const prefix = (base || "isletme").slice(0, 20);
  const suffix = randomBytes(2).toString("hex").toLowerCase();
  return `${prefix}${suffix}`.slice(0, 30);
}

function generateTemporaryPassword(): string {
  return `${randomBytes(6).toString("base64url")}A1`;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Veritabani baglantisi yapilandirilmamis" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    business_type_id?: string;
    owner_phone_e164?: string;
    tenant_code?: string;
    owner_username?: string;
    password?: string;
    status?: "active" | "inactive" | "suspended";
    campaign_enabled?: boolean;
    subscription_plan?: "starter" | "growth" | "pro" | "enterprise" | "custom";
  };

  const name = (body.name || "").trim();
  const businessTypeId = (body.business_type_id || "").trim();
  const ownerPhone = (body.owner_phone_e164 || "").trim();
  const tenantCode = sanitizeTenantCode(body.tenant_code || "") || generateTenantCode(name);
  const ownerUsername = normalizeUsername(body.owner_username || generateUsername(name));
  const password = (body.password || "").trim() || generateTemporaryPassword();
  const generatedPassword = !body.password;

  if (!name || !businessTypeId) {
    return NextResponse.json(
      { error: "name ve business_type_id zorunlu" },
      { status: 400 }
    );
  }

  if (!ownerPhone || !ownerPhone.startsWith("+")) {
    return NextResponse.json(
      { error: "owner_phone_e164 zorunlu (ornek: +905551234567)" },
      { status: 400 }
    );
  }

  if (!ownerUsername || !isValidUsername(ownerUsername)) {
    return NextResponse.json(
      {
        error:
          "owner_username gecersiz. 3-32 karakter olmali ve sadece kucuk harf/rakam/nokta/tire/alt cizgi icermeli.",
      },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "password en az 6 karakter olmali" },
      { status: 400 }
    );
  }

  const { data: existingCode } = await supabase
    .from("tenants")
    .select("id")
    .eq("tenant_code", tenantCode)
    .maybeSingle();
  if (existingCode) {
    return NextResponse.json(
      { error: `Bu tenant kodu zaten kullanimda: ${tenantCode}` },
      { status: 400 }
    );
  }

  const { data: existingUsername, error: existingUsernameErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_username", ownerUsername)
    .maybeSingle();
  const missingUsernameCol = extractMissingSchemaColumn(existingUsernameErr);
  if (
    existingUsernameErr &&
    (!missingUsernameCol ||
      missingUsernameCol.table !== "tenants" ||
      missingUsernameCol.column !== "owner_username")
  ) {
    return NextResponse.json(
      { error: `Kullanici adi kontrol edilemedi: ${existingUsernameErr.message}` },
      { status: 500 }
    );
  }
  if (existingUsername) {
    return NextResponse.json(
      { error: `Bu kullanici adi zaten kullanimda: ${ownerUsername}` },
      { status: 400 }
    );
  }

  const loginEmail = usernameToLoginEmail(ownerUsername);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData?.user?.id) {
    return NextResponse.json(
      { error: `Auth kullanicisi olusturulamadi: ${authError?.message || "unknown"}` },
      { status: 400 }
    );
  }

  const userId = authData.user.id;

  const tenantPayload: Record<string, unknown> = {
    business_type_id: businessTypeId,
    name,
    tenant_code: tenantCode,
    status: body.status || "active",
    campaign_enabled: body.campaign_enabled !== false,
    user_id: userId,
    owner_username: ownerUsername,
    owner_phone_e164: ownerPhone,
    security_config: { sms_2fa_enabled: true },
    ui_preferences: {},
    subscription_plan: body.subscription_plan || "starter",
  };

  let tenantRow: Record<string, unknown> | null = null;
  let insertError: { message: string } | null = null;

  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase
      .from("tenants")
      .insert(tenantPayload)
      .select("id, name, tenant_code, owner_username")
      .single();

    if (!error) {
      tenantRow = (data ?? null) as unknown as Record<string, unknown>;
      insertError = null;
      break;
    }

    insertError = { message: error.message };
    const missing = extractMissingSchemaColumn(error);
    if (
      !missing ||
      missing.table !== "tenants" ||
      !FALLBACK_TENANT_COLUMNS.has(missing.column) ||
      !(missing.column in tenantPayload)
    ) {
      break;
    }

    delete tenantPayload[missing.column];
  }

  if (insertError || !tenantRow) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    const missing = extractMissingSchemaColumn(insertError);
    if (missing?.table === "tenants") {
      return NextResponse.json(
        {
          error:
            `Tenant olusturulamadi: veritabani semasi guncel degil (eksik kolon: ${missing.column}). ` +
            "Supabase migration 010/011/027 calistirilmali.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Tenant olusturulamadi: ${insertError?.message || "unknown"}` },
      { status: 500 }
    );
  }

  await logTenantEvent({
    tenantId: String(tenantRow.id),
    eventType: "tenant_quick_created",
    actor: "admin",
    entityType: "tenant",
    entityId: String(tenantRow.id),
    payload: {
      tenant_code: tenantCode,
      owner_username: ownerUsername,
      generated_password: generatedPassword,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    id: tenantRow.id,
    name: tenantRow.name,
    tenant_code: tenantCode,
    owner_username: ownerUsername,
    login_email: loginEmail,
    temporary_password: password,
    generated_password: generatedPassword,
    message: "Quick tenant olusturuldu",
  });
}
