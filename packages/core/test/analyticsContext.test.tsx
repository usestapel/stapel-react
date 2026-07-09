import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createStapelClient } from "../src/client.js";
import { StapelConfigProvider } from "../src/config.js";
import { useAnalytics } from "../src/analytics/context.js";
import type { Analytics } from "../src/analytics/types.js";

const client = createStapelClient({ baseUrl: "https://api.test" });

/**
 * A minimal in-test seam implementation. The real facade moved to
 * `@stapel/analytics` (slim-wave §21/S1) — core's contract is only the
 * `Analytics` TYPE + the context plumbing, which is exactly what a
 * bring-your-own-provider host exercises.
 */
function fakeAnalytics(): Analytics {
  return {
    track: () => undefined,
    identify: () => undefined,
    page: () => undefined,
    flush: () => Promise.resolve(),
    setConsent: () => Promise.resolve(),
    getConsent: () => "granted",
    register: () => undefined,
    unregister: () => undefined,
  };
}

describe("useAnalytics via StapelConfigProvider", () => {
  it("returns the instance passed through the analytics prop", () => {
    const analytics = fakeAnalytics();
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
