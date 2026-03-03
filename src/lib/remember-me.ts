"use client";

const REMEMBER_ME_COOKIE = "ahi-ai-remember-me";
const REMEMBER_ME_MAX_AGE = 365 * 24 * 60 * 60; // 1 yıl (tercih hatırlansın)

export function getRememberMe(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REMEMBER_ME_COOKIE}=([^;]*)`));
  const value = match ? match[1] : null;
  return value === "1";
}

export function setRememberMeCookie(remember: boolean): void {
  if (typeof document === "undefined") return;
  const value = remember ? "1" : "0";
  document.cookie = `${REMEMBER_ME_COOKIE}=${value}; path=/; max-age=${REMEMBER_ME_MAX_AGE}; SameSite=Lax`;
}
