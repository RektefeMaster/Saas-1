import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { DASHBOARD_OTP_COOKIE, isSms2faEnabledFlag } from "@/lib/otp-auth";

const ADMIN_COOKIE = "admin_session";
const SUPABASE_TENANTS_REST_PATH = "/rest/v1/tenants";

async function isAdminAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

function extractTenantIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/tenant\/([^/]+)/);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function createMiddlewareSupabase(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return {
    supabase,
    getResponse: () => supabaseResponse,
  };
}

async function isTenantOwnedByUser(
  tenantId: string,
  userId: string
): Promise<"owned" | "forbidden" | "error"> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!baseUrl || !serviceRole) {
    return "error";
  }

  const url = new URL(SUPABASE_TENANTS_REST_PATH, baseUrl);
  url.searchParams.set("select", "id");
  url.searchParams.set("id", `eq.${tenantId}`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("deleted_at", "is.null");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const payload = await res.text().catch(() => "");
    console.error("[proxy] tenant ownership check failed:", res.status, payload);
    return "error";
  }

  const rows = (await res.json().catch(() => [])) as Array<{ id?: string }>;
  return Array.isArray(rows) && rows.length > 0 ? "owned" : "forbidden";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sms2faEnabled = isSms2faEnabledFlag();

  // Dashboard koruması (Supabase Auth)
  if (pathname.startsWith("/dashboard")) {
    const isDashboardLogin = pathname === "/dashboard/login";
    const isDashboardVerify = pathname === "/dashboard/login/verify";
    const { supabase, getResponse } = createMiddlewareSupabase(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const supabaseResponse = getResponse();

    if (isDashboardLogin || isDashboardVerify) {
      if (!user) return supabaseResponse;
      if (!sms2faEnabled) {
        if (isDashboardLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      const otpCookie = request.cookies.get(DASHBOARD_OTP_COOKIE)?.value;
      const otpVerified = otpCookie === user.id;
      if (otpVerified && (isDashboardLogin || isDashboardVerify)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      if (!otpVerified && isDashboardLogin) {
        return NextResponse.redirect(new URL("/dashboard/login/verify", request.url));
      }
      return supabaseResponse;
    }

    if (!user) {
      return NextResponse.redirect(
        new URL("/dashboard/login", request.url)
      );
    }

    if (sms2faEnabled) {
      const otpCookie = request.cookies.get(DASHBOARD_OTP_COOKIE)?.value;
      const otpVerified = otpCookie === user.id;
      if (!otpVerified) {
        return NextResponse.redirect(new URL("/dashboard/login/verify", request.url));
      }
    }

    return supabaseResponse;
  }

  // Tenant API koruması: sadece admin veya tenant sahibi erişebilir.
  if (pathname.startsWith("/api/tenant/")) {
    const tenantId = extractTenantIdFromPath(pathname);
    if (!tenantId) {
      return NextResponse.json({ error: "Geçersiz tenant yolu" }, { status: 400 });
    }

    const adminAuthenticated = await isAdminAuthenticated(request);
    if (adminAuthenticated) {
      return NextResponse.next();
    }

    const { supabase, getResponse } = createMiddlewareSupabase(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 });
    }

    if (sms2faEnabled) {
      const otpCookie = request.cookies.get(DASHBOARD_OTP_COOKIE)?.value;
      const otpVerified = otpCookie === user.id;
      if (!otpVerified) {
        return NextResponse.json({ error: "SMS doğrulaması gerekli" }, { status: 403 });
      }
    }

    const ownership = await isTenantOwnedByUser(tenantId, user.id);
    if (ownership === "error") {
      return NextResponse.json(
        { error: "Tenant erişim doğrulaması yapılamadı" },
        { status: 500 }
      );
    }
    if (ownership === "forbidden") {
      return NextResponse.json({ error: "Bu tenant için yetkiniz yok" }, { status: 403 });
    }

    return getResponse();
  }

  // Admin koruması (mevcut cookie auth)
  const isLoginPage = pathname === "/admin/login";
  const isAdminOtpBridge =
    isLoginPage &&
    request.nextUrl.searchParams.get("mode") === "otp" &&
    Boolean(request.nextUrl.searchParams.get("challenge"));
  const isAdminAuthApi =
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout" ||
    pathname === "/api/admin/auth/verify" ||
    pathname === "/api/admin/auth/hidden";
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminAuthApi) {
    return NextResponse.next();
  }

  if (isAdminRoute || isAdminApi) {
    const authenticated = await isAdminAuthenticated(request);
    if (authenticated) {
      if (isLoginPage) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }
    if (isLoginPage) {
      if (isAdminOtpBridge) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
    if (isAdminApi) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/dashboard/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/admin/:path*", "/api/tenant/:path*"],
};
