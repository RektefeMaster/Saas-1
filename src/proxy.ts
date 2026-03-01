import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { DASHBOARD_OTP_COOKIE, isSms2faEnabledFlag } from "@/lib/otp-auth";

const ADMIN_COOKIE = "admin_session";

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sms2faEnabled = isSms2faEnabledFlag();

  // Dashboard koruması (Supabase Auth)
  if (pathname.startsWith("/dashboard")) {
    const isDashboardLogin = pathname === "/dashboard/login";
    const isDashboardVerify = pathname === "/dashboard/login/verify";
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
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

  // Admin koruması (mevcut cookie auth)
  const isLoginPage = pathname === "/admin/login";
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
      return NextResponse.next();
    }
    if (isAdminApi) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/admin/:path*"],
};
