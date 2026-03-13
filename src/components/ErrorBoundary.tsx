"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Güvenli erişim - this.props kontrolü
    try {
      if (!this.props) {
        console.error("[ErrorBoundary] Props is null in componentDidCatch:", error, errorInfo);
        return;
      }
      
      const componentInfo = this.props.componentName ? ` in ${this.props.componentName}` : "";
      console.error(`[ErrorBoundary] Error${componentInfo}:`, error, errorInfo);
      
      // Hata detaylarını logla
      if (error.message?.includes("children")) {
        console.error("[ErrorBoundary] Children hatası tespit edildi:", {
          componentName: this.props.componentName,
          hasProps: !!this.props,
          hasChildren: this.props?.children != null,
          childrenType: typeof this.props?.children,
          errorStack: error.stack,
          errorInfo,
        });
      }
      // Sentry'ye gönderilebilir
    } catch (err) {
      console.error("[ErrorBoundary] componentDidCatch hatası:", err, error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/50">
            <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-200">
              Bir hata oluştu
            </h2>
            <p className="mb-4 text-sm text-red-600 dark:text-red-300">
              {this.state.error?.message || "Bilinmeyen bir hata oluştu"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    // Güvenli children erişimi - props ve children kontrolü
    // React 19'da null children sorun yaratabilir, boş Fragment kullan
    try {
      if (!this.props) {
        console.warn("[ErrorBoundary] Props is null or undefined");
        return <></>;
      }
      
      const children = this.props.children;
      // React 19 uyumluluğu - null children yerine boş Fragment kullan
      if (children == null) {
        return <></>;
      }

      // React 19 uyumluluğu - children'ı Fragment içine al
      return <>{children}</>;
    } catch (error) {
      console.error("[ErrorBoundary] Render hatası:", error);
      return <></>;
    }
  }
}
