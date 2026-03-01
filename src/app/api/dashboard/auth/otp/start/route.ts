import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";
import { setOtpChallenge } from "@/lib/redis";
import { sendSmsVerification } from "@/lib/twilio";
import { OTP_TTL_SECONDS, isSms2faEnabledFlag } from "@/lib/otp-auth";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";

export async function POST(_request: NextRequest) {
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

    const requestedColumns = ["id", "owner_phone_e164", "contact_phone", "security_config"];
    let selectColumns = [...requestedColumns];
    const missingColumns = new Set<string>();
    let tenant: Record<string, unknown> | null = null;
    let tenantError: { message: string } | null = null;
    for (let i = 0; i < requestedColumns.length; i++) {
      const result = await supabase
        .from("tenants")
        .select(selectColumns.join(", "))
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();
      if (!result.error) {
        tenant = (result.data ?? null) as unknown as Record<string, unknown>;
        tenantError = null;
        break;
      }
      tenantError = { message: result.error.message };
      const missing = extractMissingSchemaColumn(result.error);
      if (!missing || missing.table !== "tenants" || !selectColumns.includes(missing.column)) {
        break;
      }
      selectColumns = selectColumns.filter((c) => c !== missing.column);
      missingColumns.add(missing.column);
    }

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });
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
      return NextResponse.json(
        { error: "Bu hesap için owner_phone_e164 veya contact_phone tanımlı değil." },
        { status: 400 }
      );
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
