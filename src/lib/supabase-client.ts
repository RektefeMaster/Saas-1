"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Debug: Production'da kaldırılabilir
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
    return createBrowserClient(url, anonKey);
  } catch (error) {
    console.error("Supabase client oluşturma hatası:", error);
    throw new Error(
      `Supabase client oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
