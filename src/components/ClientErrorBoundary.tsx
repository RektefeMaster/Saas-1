"use client";

import { ErrorBoundary } from "./ErrorBoundary";

export function ClientErrorBoundary({ 
  children, 
  componentName 
}: { 
  children: React.ReactNode;
  componentName?: string;
}) {
  // Güvenli children kontrolü
  try {
    if (children == null) {
      return null;
    }
    return <ErrorBoundary componentName={componentName}>{children}</ErrorBoundary>;
  } catch (error) {
    console.error("[ClientErrorBoundary] Hata:", error, { componentName });
    return null;
  }
}
