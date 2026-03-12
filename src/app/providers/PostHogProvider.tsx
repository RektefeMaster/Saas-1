"use client";

import React, { useEffect, useState } from "react";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

function PostHogInner({ children }: { children: React.ReactNode }) {
  const [Client, setClient] = useState<React.ComponentType<any> | null>(null);
  const [posthog, setPosthog] = useState<unknown>(null);

  useEffect(() => {
    if (!key || typeof window === "undefined") return;

    const load = () => {
      import("posthog-js").then((mod) => {
        const ph = mod.default;
        ph.init(key, {
          api_host: host,
          capture_pageview: true,
          person_profiles: "identified_only",
        });
        setPosthog(ph);
        import("posthog-js/react").then((reactMod) => {
          setClient(reactMod.PostHogProvider);
        });
      });
    };

    if ("requestIdleCallback" in window) {
      // Timeout 500ms - kullanıcı etkileşimi başlamadan önce yüklenmeli
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(load, { timeout: 500 });
    } else {
      setTimeout(load, 500);
    }
  }, []);

  if (!key) return <>{children}</>;
  if (!Client || !posthog) return <>{children}</>;
  
  // PostHogProvider accepts client prop
  // Using React.createElement to avoid type issues
  return React.createElement(Client, { client: posthog }, children);
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogInner>{children}</PostHogInner>;
}
