import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isAdminAuthApi =
    pathname === "/api/admin/auth/login" || pathname === "/api/admin/auth/logout";
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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
