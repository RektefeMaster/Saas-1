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
  // Null check ekle - React 19'da SWRConfig'in children prop'una null geçildiğinde sorun olabilir
  if (children == null) {
    // SWRConfig null children'ı desteklemiyor olabilir, boş Fragment döndür
    return (
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 30000,
          errorRetryCount: 3,
          errorRetryInterval: 5000,
          onError: (error, key) => {
            if (process.env.NODE_ENV === "development") {
              console.error("[SWR Error]", key, error);
            }
          },
          onSuccess: (data, key) => {
            if (process.env.NODE_ENV === "development") {
              console.log("[SWR Success]", key);
            }
          },
        }}
      >
        {null}
      </SWRConfig>
    );
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
    // Hata durumunda da SWRConfig'i boş children ile döndür
    return (
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 30000,
          errorRetryCount: 3,
          errorRetryInterval: 5000,
        }}
      >
        {null}
      </SWRConfig>
    );
  }
}
