import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION = 60 * 60 * 8; // 8 saat
const MIN_PASSWORD_LENGTH = 8;

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET en az 32 karakter olmalı (.env)");
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

function sha256(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

/** Timing-safe şifre karşılaştırması; brute-force ve timing attack riskini azaltır. */
export function isAdminPasswordValid(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof expected !== "string" || expected.length < MIN_PASSWORD_LENGTH) {
    return false;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return false;
  }
  const a = sha256(password);
  const b = sha256(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}

export function getAdminCookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION,
  };
}
