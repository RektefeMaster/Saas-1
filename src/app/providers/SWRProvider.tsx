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
  return (
    <SWRConfig
      value={{
        fetcher,
        // Mobilde sekme değişiminde gereksiz ağ/CPU yükünü azalt.
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        refreshWhenHidden: false,
        focusThrottleInterval: 60000,
        dedupingInterval: 30000,
        keepPreviousData: true,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        onError: (error, key) => {
          if (process.env.NODE_ENV === "development") {
            console.error("[SWR Error]", key, error);
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
