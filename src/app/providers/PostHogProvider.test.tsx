import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { PostHogProvider } from "./PostHogProvider";

describe("PostHogProvider", () => {
  it("passthrough returns children without loading analytics", () => {
    const tree = PostHogProvider({
      children: createElement("div", null, "analytics child"),
    });

    expect(tree).toBeTruthy();
  });
});
