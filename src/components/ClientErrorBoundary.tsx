"use client";

import { ErrorBoundary } from "./ErrorBoundary";

export function ClientErrorBoundary({ 
  children, 
  componentName 
}: { 
  children: React.ReactNode;
  componentName?: string;
}) {
  // Null check ekle
  if (children == null) {
    return null;
  }
  return <ErrorBoundary componentName={componentName}>{children}</ErrorBoundary>;
}
