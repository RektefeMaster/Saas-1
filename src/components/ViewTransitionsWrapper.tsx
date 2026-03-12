"use client";

import { ViewTransitions } from "next-view-transitions";

export function ViewTransitionsWrapper({ children }: { children: React.ReactNode }) {
  return <ViewTransitions>{children}</ViewTransitions>;
}
