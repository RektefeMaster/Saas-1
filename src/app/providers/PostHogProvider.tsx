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
        return null;
      }
      return this.props.fallback || this.props.children || null;
    }
    // Güvenli erişim - this.props kontrolü
    if (!this.props) {
      return null;
    }
    if (this.props.children == null) {
      return null;
    }
    return this.props.children;
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
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
  // if (!key) return <>{children}</>;
  // if (error) return <>{children}</>;
  // if (!Client || !posthog) return <>{children}</>;
  
  // Client component'ini güvenli bir şekilde render et
  // const PostHogClientProvider = Client as React.ComponentType<{ client: any; children: React.ReactNode }>;

  // return (
  //   <PostHogErrorBoundary fallback={<>{children}</>}>
  //     <PostHogClientProvider client={posthog}>
  //       {children}
  //     </PostHogClientProvider>
  //   </PostHogErrorBoundary>
  // );

  // Geçici olarak sadece children döndür
  // Null check ekle
  if (children == null) {
    return null;
  }
  
  // React 19 uyumluluğu için güvenli Fragment kullanımı
  return <React.Fragment>{children}</React.Fragment>;
}
