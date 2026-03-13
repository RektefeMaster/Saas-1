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
    if (!this.props) {
      console.error("[PostHogErrorBoundary] Props is null in componentDidCatch:", error, errorInfo);
      return;
    }
    console.error("PostHogProvider error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Güvenli erişim - this.props kontrolü
      if (!this.props) {
        return <></>;
      }
      // React 19 uyumluluğu - null children yerine boş Fragment kullan
      if (this.props.fallback != null) {
        return this.props.fallback;
      }
      if (this.props.children == null) {
        return <></>;
      }
      return this.props.children;
    }
    // Güvenli erişim - this.props kontrolü
    if (!this.props) {
      return <></>;
    }
    // React 19 uyumluluğu - null children yerine boş Fragment kullan
    if (this.props.children == null) {
      return <></>;
    }
    return this.props.children;
  }
}

export function PostHogProvider(props: { children?: React.ReactNode }) {
  // React 19 uyumluluğu - props null olabilir, bu yüzden güvenli kontrol
  // useState hook'u sırasında props null ise sorun çıkabilir
  const safeChildren = props?.children != null ? props.children : <></>;
  
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
  return <React.Fragment>{safeChildren}</React.Fragment>;
}
