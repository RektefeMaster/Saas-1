"use client";

import { parse, serialize } from "cookie";
import { createBrowserClient } from "@supabase/ssr";
import { getRememberMe } from "@/lib/remember-me";

/** Auth ile ilgili cookie adları (Supabase session); sadece "beni hatırla" seçiliyse kalıcı olur. */
function isAuthCookieName(name: string): boolean {
  return name.includes("auth") || name.startsWith("sb-");
}

/** Tarayıcıda "beni hatırla" kapalıysa oturum çerezi (session), açıksa kalıcı çerez kullanır. */
function getBrowserAuthCookies() {
  return {
    getAll: async (): Promise<{ name: string; value: string }[]> => {
      if (typeof document === "undefined") return [];
      const parsed = parse(document.cookie);
      return Object.entries(parsed).map(([name, value]) => ({ name, value: value ?? "" }));
    },
    setAll: (cookies: { name: string; value: string; options?: { maxAge?: number; path?: string; sameSite?: "lax" | "strict" | "none"; [k: string]: unknown } }[]) => {
      if (typeof document === "undefined") return;
      const remember = getRememberMe();
      for (const { name, value, options = {} } of cookies) {
        const isAuth = isAuthCookieName(name);
        const opts = { path: "/", sameSite: "lax" as const, ...options };
        if (value) {
          if (isAuth && !remember) {
            delete (opts as Record<string, unknown>).maxAge;
          } else if (isAuth && remember) {
            (opts as Record<string, unknown>).maxAge = opts.maxAge ?? 30 * 24 * 60 * 60;
          }
        } else {
          (opts as Record<string, unknown>).maxAge = 0;
        }
        document.cookie = serialize(name, value, opts);
      }
    },
  };
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("Supabase Config Check:", {
      hasUrl: !!url,
      hasKey: !!anonKey,
      urlLength: url?.length || 0,
      keyLength: anonKey?.length || 0,
      urlStart: url?.substring(0, 20) || "N/A",
    });
  }

  if (!url || !anonKey) {
    const missing = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    throw new Error(
      `Supabase yapılandırması eksik. Eksik değişkenler: ${missing.join(", ")}. Lütfen .env dosyanızı kontrol edin ve Next.js dev server'ını yeniden başlatın.`
    );
  }

  if (url.includes("your-project") || url === "" || anonKey === "" || anonKey.includes("your-anon-key")) {
    throw new Error(
      "Supabase yapılandırması geçersiz. Lütfen .env dosyanızda NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY değerlerini kontrol edin."
    );
  }

  try {
    return createBrowserClient(url, anonKey, {
      cookies: getBrowserAuthCookies(),
    });
  } catch (error) {
    console.error("Supabase client oluşturma hatası:", error);
    throw new Error(
      `Supabase client oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
