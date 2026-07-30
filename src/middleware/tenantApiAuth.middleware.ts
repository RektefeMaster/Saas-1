/**
 * Defense-in-depth for high-risk tenant mutation routes.
 * Proxy remains the primary gate; handlers call this for an extra ownership check.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabase as serviceSupabase } from "@/lib/supabase";
import { verifyAdminToken, getAdminCookieName } from "@/lib/admin-auth";
import {
  DASHBOARD_OTP_COOKIE,
  isSms2faEnabledFlag,
  verifyDashboardOtpCookieValue,
} from "@/lib/otp-auth";
import { loginEmailToUsernameDisplay, normalizeUsername } from "@/lib/username-auth";
import { requireValidTenantId, TenantScopeError } from "@/middleware/tenantScope.middleware";

export type TenantApiAuthResult =
  | { ok: true; actor: "admin" | "owner"; userId?: string }
  | { ok: false; response: NextResponse };

async function isTenantOwnedByUser(
  tenantId: string,
  userId: string,
  userEmail: string | null | undefined
): Promise<boolean> {
  const { data, error } = await serviceSupabase
    .from("tenants")
    .select("id, user_id, owner_username")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[tenantApiAuth] ownership check failed:", error.message);
    return false;
  }
  if (!data?.id) return false;

  if (typeof data.user_id === "string" && data.user_id === userId) {
    return true;
  }

  const ownerUsername =
    typeof data.owner_username === "string" ? normalizeUsername(data.owner_username) : "";
  const loginUsername = normalizeUsername(loginEmailToUsernameDisplay(userEmail));
  return Boolean(ownerUsername && loginUsername && ownerUsername === loginUsername);
}

export async function requireTenantApiAccess(
  request: NextRequest,
  tenantId: string
): Promise<TenantApiAuthResult> {
  try {
    requireValidTenantId(tenantId);
  } catch (err) {
    if (err instanceof TenantScopeError) {
      return {
        ok: false,
        response: NextResponse.json({ error: err.message }, { status: err.status }),
      };
    }
    throw err;
  }

  const adminCookie = request.cookies.get(getAdminCookieName())?.value;
  if (adminCookie && (await verifyAdminToken(adminCookie))) {
    return { ok: true, actor: "admin" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 }),
    };
  }

  if (isSms2faEnabledFlag()) {
    const otpCookie = request.cookies.get(DASHBOARD_OTP_COOKIE)?.value;
    if (!verifyDashboardOtpCookieValue(otpCookie, user.id)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "SMS doğrulaması gerekli" }, { status: 403 }),
      };
    }
  }

  const owned = await isTenantOwnedByUser(tenantId, user.id, user.email);
  if (!owned) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Bu tenant için yetkiniz yok" }, { status: 403 }),
    };
  }

  return { ok: true, actor: "owner", userId: user.id };
}
