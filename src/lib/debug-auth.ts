import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, verifyAdminToken } from "@/lib/admin-auth";

export async function requireDebugAccess(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 });
  }

  const ok = await verifyAdminToken(token);
  if (!ok) {
    return NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 });
  }

  return null;
}
