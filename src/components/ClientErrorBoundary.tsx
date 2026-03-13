"use client";

import { ErrorBoundary } from "./ErrorBoundary";

export function ClientErrorBoundary({ 
  children, 
  componentName 
}: { 
  children: React.ReactNode;
  componentName?: string;
}) {
  // Güvenli children kontrolü - React 19'da null children sorun yaratabilir
  try {
    // Null children yerine boş Fragment kullan
    const safeChildren = children ?? <></>;
    return <ErrorBoundary componentName={componentName}>{safeChildren}</ErrorBoundary>;
  } catch (error) {
    console.error("[ClientErrorBoundary] Hata:", error, { componentName });
    return <ErrorBoundary componentName={componentName}><></></ErrorBoundary>;
  }
}
