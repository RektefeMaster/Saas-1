import { NextResponse } from "next/server";
import { DASHBOARD_OTP_COOKIE } from "@/lib/otp-auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(DASHBOARD_OTP_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
