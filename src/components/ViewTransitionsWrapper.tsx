"use client";

import { ViewTransitions } from "next-view-transitions";
import { Component, ErrorInfo, ReactNode } from "react";

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
    console.error("ViewTransitions error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || this.props.children || null;
    }
    // Null check ekle - this.props hiçbir zaman null olmaz, sadece children kontrolü yeterli
    if (this.props.children == null) {
      return null;
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
  
  // Null check ekle
  if (children == null) {
    return null;
  }
  
  return <>{children}</>;
}
