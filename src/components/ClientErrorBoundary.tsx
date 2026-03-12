"use client";

import { ErrorBoundary } from "./ErrorBoundary";

export function ClientErrorBoundary({ 
  children, 
  componentName 
}: { 
  children: React.ReactNode;
  componentName?: string;
}) {
  return <ErrorBoundary componentName={componentName}>{children}</ErrorBoundary>;
}
