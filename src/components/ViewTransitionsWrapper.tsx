"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

class ViewTransitionsErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
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
      console.error("[ViewTransitionsErrorBoundary] Props is null in componentDidCatch:", error, errorInfo);
      return;
    }
    console.error("ViewTransitions error:", error, errorInfo);
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

export function ViewTransitionsWrapper({ children }: { children: React.ReactNode }) {
  // ViewTransitions geçici olarak devre dışı - sorun giderilene kadar
  // return (
  //   <ViewTransitionsErrorBoundary fallback={<>{children}</>}>
  //     <ViewTransitions>{children}</ViewTransitions>
  //   </ViewTransitionsErrorBoundary>
  // );
  
  // React 19 uyumluluğu - null children yerine boş Fragment kullan
  const safeChildren = children ?? <></>;
  return <React.Fragment>{safeChildren}</React.Fragment>;
}
