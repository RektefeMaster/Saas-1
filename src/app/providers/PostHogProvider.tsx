"use client";

import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

class PostHogErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Güvenli erişim - this.props kontrolü
    try {
      if (!this.props) {
        console.error("[PostHogErrorBoundary] Props is null in componentDidCatch:", error, errorInfo);
        return;
      }
      console.error("[PostHogErrorBoundary] PostHogProvider error:", error, errorInfo);
    } catch (err) {
      console.error("[PostHogErrorBoundary] componentDidCatch hatası:", err, error, errorInfo);
    }
  }

  render() {
    try {
      if (this.state.hasError) {
        // Güvenli erişim - this.props kontrolü
        if (!this.props) {
          console.warn("[PostHogErrorBoundary] Props is null in error state");
          return <></>;
        }
        // React 19 uyumluluğu - null children yerine boş Fragment kullan
        if (this.props.fallback != null) {
          return <>{this.props.fallback}</>;
        }
        if (this.props.children == null) {
          return <></>;
        }
        return <>{this.props.children}</>;
      }
      // Güvenli erişim - this.props kontrolü
      if (!this.props) {
        console.warn("[PostHogErrorBoundary] Props is null in normal render");
        return <></>;
      }
      // React 19 uyumluluğu - null children yerine boş Fragment kullan
      if (this.props.children == null) {
        return <></>;
      }
      return <>{this.props.children}</>;
    } catch (err) {
      console.error("[PostHogErrorBoundary] Render hatası:", err);
      return <></>;
    }
  }
}

export function PostHogProvider(props: { children?: React.ReactNode }) {
  // React 19 uyumluluğu - props null/undefined olabilir, bu yüzden güvenli kontrol
  // useState hook'u sırasında props null/undefined ise sorun çıkabilir
  // ÖNEMLİ: props kontrolünü useState'ten ÖNCE yap
  // == null kontrolü hem null hem undefined'ı yakalar
  if (props == null) {
    console.warn("[PostHogProvider] Props is null or undefined");
    return <></>;
  }
  
  // Children prop'unu güvenli şekilde al
  const safeChildren = props.children != null ? props.children : <></>;
  
  const [Client, setClient] = useState<React.ComponentType<any> | null>(null);
  const [posthog, setPosthog] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!key || typeof window === "undefined") return;

    const load = async () => {
      try {
        const posthogModule = await import("posthog-js");
        const ph = posthogModule.default;
        
        // PostHog'u başlat
        ph.init(key, {
          api_host: host,
          capture_pageview: true,
          person_profiles: "identified_only",
        });

        // PostHog başlatıldıktan sonra React provider'ı yükle
        const reactModule = await import("posthog-js/react");
        const PHProvider = reactModule.PostHogProvider;

        setPosthog(ph);
        setClient(PHProvider);
      } catch (err) {
        console.error("PostHog initialization error:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(load, { timeout: 500 });
    } else {
      setTimeout(load, 500);
    }
  }, []);

  // PostHog geçici olarak devre dışı - sorun giderilene kadar
  // if (!key) return <>{safeChildren}</>;
  // if (error) return <>{safeChildren}</>;
  // if (!Client || !posthog) return <>{safeChildren}</>;
  
  // Client component'ini güvenli bir şekilde render et
  // const PostHogClientProvider = Client as React.ComponentType<{ client: any; children: React.ReactNode }>;

  // return (
  //   <PostHogErrorBoundary fallback={<>{safeChildren}</>}>
  //     <PostHogClientProvider client={posthog}>
  //       {safeChildren}
  //     </PostHogClientProvider>
  //   </PostHogErrorBoundary>
  // );

  // Geçici olarak sadece children döndür
  // React 19 uyumluluğu - null children yerine boş Fragment kullan
  // Güvenli render - children null/undefined kontrolü
  try {
    if (safeChildren == null) {
      return <></>;
    }
    return <>{safeChildren}</>;
  } catch (err) {
    console.error("[PostHogProvider] Render hatası:", err);
    return <></>;
  }
}
