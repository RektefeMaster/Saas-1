import { NextRequest, NextResponse } from "next/server";
import {
  createAdminToken,
  isAdminPasswordValid,
  getAdminCookieName,
  getAdminCookieOpts,
} from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Şifre gerekli" },
        { status: 400 }
      );
    }

    if (!isAdminPasswordValid(password)) {
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json(
        { error: "Geçersiz şifre" },
        { status: 401 }
      );
    }

    const token = await createAdminToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set(getAdminCookieName(), token, getAdminCookieOpts());
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Giriş hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
