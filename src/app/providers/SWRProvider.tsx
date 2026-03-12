"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr-fetcher";

interface SWRProviderProps {
  children: React.ReactNode;
}

/**
 * Global SWR configuration provider
 * - Global error handler
 * - Global loading state
 * - Consistent cache settings
 */
export function SWRProvider({ children }: SWRProviderProps) {
  // Null check ekle
  if (children == null) {
    return null;
  }
  
  // Güvenli render
  try {
    return (
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: false, // Polling kullanıldığı için focus revalidation gereksiz
          revalidateOnReconnect: true, // Bağlantı yeniden kurulduğunda revalidate
          dedupingInterval: 30000, // 30 saniye içinde aynı key için tekrar fetch yapma
          errorRetryCount: 3, // Hata durumunda 3 kez tekrar dene
          errorRetryInterval: 5000, // Her retry arasında 5 saniye bekle
          onError: (error, key) => {
            // Global error handler - production'da Sentry'ye gönderilebilir
            if (process.env.NODE_ENV === "development") {
              console.error("[SWR Error]", key, error);
            }
          },
          onSuccess: (data, key) => {
            // Global success handler - isteğe bağlı
            if (process.env.NODE_ENV === "development") {
              console.log("[SWR Success]", key);
            }
          },
        }}
      >
        {children}
      </SWRConfig>
    );
  } catch (error) {
    console.error("[SWRProvider] Render hatası:", error);
    return null;
  }
}
