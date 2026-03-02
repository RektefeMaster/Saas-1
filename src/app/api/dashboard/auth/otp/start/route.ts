import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";
import { loginEmailToUsernameDisplay, normalizeUsername } from "@/lib/username-auth";
import { setOtpChallenge } from "@/lib/redis";
import { getTwilioVerifyStatus, sendSmsVerification } from "@/lib/twilio";
import { OTP_TTL_SECONDS, isSms2faEnabledFlag } from "@/lib/otp-auth";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";

async function findTenantByUserId(userId: string): Promise<{
  tenant: Record<string, unknown> | null;
  missingColumns: Set<string>;
}> {
  const requestedColumns = [
    "id",
    "user_id",
    "owner_username",
    "owner_phone_e164",
    "contact_phone",
    "security_config",
  ];
  let selectColumns = [...requestedColumns];
  const missingColumns = new Set<string>();
  for (let i = 0; i < requestedColumns.length; i++) {
    const result = await supabase
      .from("tenants")
      .select(selectColumns.join(", "))
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!result.error) {
      return {
        tenant: (result.data ?? null) as Record<string, unknown> | null,
        missingColumns,
      };
    }
    const missing = extractMissingSchemaColumn(result.error);
    if (!missing || missing.table !== "tenants" || !selectColumns.includes(missing.column)) {
      return { tenant: null, missingColumns };
    }
    selectColumns = selectColumns.filter((c) => c !== missing.column);
    missingColumns.add(missing.column);
  }
  return { tenant: null, missingColumns };
}

async function findTenantByOwnerUsername(ownerUsername: string): Promise<{
  tenant: Record<string, unknown> | null;
  missingColumns: Set<string>;
}> {
  const requestedColumns = [
    "id",
    "user_id",
    "owner_username",
    "owner_phone_e164",
    "contact_phone",
    "security_config",
  ];
  let selectColumns = [...requestedColumns];
  const missingColumns = new Set<string>();
  for (let i = 0; i < requestedColumns.length; i++) {
    const result = await supabase
      .from("tenants")
      .select(selectColumns.join(", "))
      .eq("owner_username", ownerUsername)
      .is("deleted_at", null)
      .maybeSingle();
    if (!result.error) {
      return {
        tenant: (result.data ?? null) as Record<string, unknown> | null,
        missingColumns,
      };
    }
    const missing = extractMissingSchemaColumn(result.error);
    if (!missing || missing.table !== "tenants" || !selectColumns.includes(missing.column)) {
      return { tenant: null, missingColumns };
    }
    selectColumns = selectColumns.filter((c) => c !== missing.column);
    missingColumns.add(missing.column);
  }
  return { tenant: null, missingColumns };
}

async function syncTenantAuthLink(
  tenant: Record<string, unknown>,
  userId: string,
  ownerUsername: string | null
): Promise<void> {
  const tenantId = typeof tenant.id === "string" ? tenant.id : null;
  if (!tenantId) return;

  const updates: Record<string, unknown> = {};
  if (tenant.user_id !== userId) {
    updates.user_id = userId;
  }
  if (ownerUsername && (typeof tenant.owner_username !== "string" || !tenant.owner_username)) {
    updates.owner_username = ownerUsername;
  }

  if (Object.keys(updates).length === 0) return;
  await supabase.from("tenants").update(updates).eq("id", tenantId);
}

export async function POST() {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
    }

    if (!isSms2faEnabledFlag()) {
      return NextResponse.json({ success: true, requires_otp: false });
    }

    const twilioStatus = getTwilioVerifyStatus();
    if (!twilioStatus.configReady) {
      const missing = twilioStatus.missing.join(", ");
      const invalid = twilioStatus.invalid.join(", ");
      const details = [missing ? `eksik: ${missing}` : "", invalid ? `geçersiz: ${invalid}` : ""]
        .filter(Boolean)
        .join(" | ");
      return NextResponse.json(
        { error: `SMS 2FA yapılandırması hazır değil${details ? ` (${details})` : ""}.` },
        { status: 503 }
      );
    }

    let { tenant, missingColumns } = await findTenantByUserId(user.id);
    const ownerUsernameFromEmail = user.email
      ? (() => {
          const ownerUsernameRaw = loginEmailToUsernameDisplay(user.email);
          if (!ownerUsernameRaw || ownerUsernameRaw === user.email) return null;
          return normalizeUsername(ownerUsernameRaw);
        })()
      : null;

    // user_id eşleşmezse owner_username ile dene (tenant.owner_username küçük harfle saklanıyor)
    if (!tenant && ownerUsernameFromEmail) {
      const byOwner = await findTenantByOwnerUsername(ownerUsernameFromEmail);
      tenant = byOwner.tenant;
      missingColumns = byOwner.missingColumns;
    }

    if (tenant) {
      await syncTenantAuthLink(tenant, user.id, ownerUsernameFromEmail);
    }

    if (!tenant) {
      return NextResponse.json(
        { error: "Bu hesapla ilişkili işletme bulunamadı. Kullanıcı adı ve şifrenizi kontrol edin veya yöneticinizle iletişime geçin." },
        { status: 404 }
      );
    }

    const securityConfig = (
      missingColumns.has("security_config") ? {} : tenant.security_config || {}
    ) as Record<string, unknown>;
    if (securityConfig.sms_2fa_enabled === false) {
      return NextResponse.json({ success: true, requires_otp: false });
    }

    const ownerPhone =
      !missingColumns.has("owner_phone_e164") && typeof tenant.owner_phone_e164 === "string"
        ? tenant.owner_phone_e164
        : "";
    const contactPhone = typeof tenant.contact_phone === "string" ? tenant.contact_phone : "";
    const phone = (ownerPhone || contactPhone || "").trim();
    if (!phone) {
      // Telefon yoksa OTP atla; kullanıcı giriş yapabilsin (işletme sahibi panelde telefon ekleyebilir)
      return NextResponse.json({ success: true, requires_otp: false });
    }

    await sendSmsVerification(phone);
    const challengeId = randomUUID();
    await setOtpChallenge(
      {
        id: challengeId,
        scope: "dashboard",
        phone,
        user_id: user.id,
        attempts: 0,
        created_at: new Date().toISOString(),
      },
      OTP_TTL_SECONDS
    );

    return NextResponse.json({
      success: true,
      requires_otp: true,
      challenge_id: challengeId,
      expires_in: OTP_TTL_SECONDS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OTP başlatılamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
