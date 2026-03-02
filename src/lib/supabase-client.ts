"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase yapılandırması eksik. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ortam değişkenleri tanımlanmalıdır."
    );
  }

  if (url.includes("your-project") || url === "" || anonKey === "" || anonKey.includes("your-anon-key")) {
    throw new Error(
      "Supabase yapılandırması geçersiz. Lütfen .env dosyanızda NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY değerlerini kontrol edin."
    );
  }

  return createBrowserClient(url, anonKey);
}
