"use client";

import type { ReactNode } from "react";

/**
 * PostHog temporarily disabled.
 * Keep a zero-cost passthrough so layout imports stay stable without
 * loading posthog-js on the critical path.
 */
export function PostHogProvider({ children }: { children?: ReactNode } = {}) {
  return <>{children ?? null}</>;
}
