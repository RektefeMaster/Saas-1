import { NextResponse } from "next/server";
import { getAdminCookieName } from "@/lib/admin-auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(getAdminCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  // Clear legacy unused admin OTP cookie if present.
  res.cookies.set("admin_otp_verified", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
