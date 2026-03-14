import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
const reactProviderSpy = vi.fn(({ children }: { children?: ReactNode }) => <>{children}</>);

vi.mock("posthog-js", () => ({
  default: {
    init: initMock,
  },
}));

vi.mock("posthog-js/react", () => ({
  PostHogProvider: reactProviderSpy,
}));

describe("PostHogProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: (callback: () => void) => {
        callback();
        return 1;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  it("stores the imported PostHog provider without invoking it as a state updater", async () => {
    const { PostHogProvider } = await import("./PostHogProvider");

    render(
      <PostHogProvider>
        <div>analytics child</div>
      </PostHogProvider>
    );

    await waitFor(() => expect(initMock).toHaveBeenCalledTimes(1));

    expect(screen.getByText("analytics child")).toBeInTheDocument();
    expect(reactProviderSpy).not.toHaveBeenCalled();
  });
});
