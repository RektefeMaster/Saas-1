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
      return this.props.fallback || this.props.children;
    }
    return this.props.children;
  }
}

export function ViewTransitionsWrapper({ children }: { children: React.ReactNode }) {
  // ViewTransitions SSR'da sorun çıkarabilir, bu yüzden error boundary ile koruyoruz
  return (
    <ViewTransitionsErrorBoundary fallback={<>{children}</>}>
      <ViewTransitions>{children}</ViewTransitions>
    </ViewTransitionsErrorBoundary>
  );
}
