import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createStapelClient } from "../src/client.js";
import { StapelConfigProvider } from "../src/config.js";
import { createAnalytics } from "../src/analytics/createAnalytics.js";
import { useAnalytics } from "../src/analytics/context.js";
import { memoryStorage } from "../src/storage.js";

const client = createStapelClient({ baseUrl: "https://api.test" });

describe("useAnalytics via StapelConfigProvider", () => {
  it("returns the instance passed through the analytics prop", () => {
    const analytics = createAnalytics({ storage: memoryStorage() });
    function Wrapper(props: { children: ReactNode }): ReactElement {
      return (
        <StapelConfigProvider config={{ client }} analytics={analytics}>
          {props.children}
        </StapelConfigProvider>
      );
    }
    const { result } = renderHook(() => useAnalytics(), { wrapper: Wrapper });
    expect(result.current).toBe(analytics);
  });

  it("stays backward-compatible: provider without analytics prop still renders, hook throws", () => {
    function Wrapper(props: { children: ReactNode }): ReactElement {
      return (
        <StapelConfigProvider config={{ client }}>
          {props.children}
        </StapelConfigProvider>
      );
    }
    expect(() =>
      renderHook(() => useAnalytics(), { wrapper: Wrapper })
    ).toThrowError(/analytics/);
  });
});
