import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { breakpoints } from "@stapel/tokens";
import type { ReactElement } from "react";
import { useBreakpoint } from "../src/useBreakpoint.js";

function setWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("useBreakpoint", () => {
  it("resolves the mounted breakpoint from window.innerWidth", () => {
    setWidth(breakpoints.tablet + 10);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("tablet");
  });

  it("tracks resize across all three breakpoints", () => {
    setWidth(500);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("phone");

    act(() => {
      setWidth(breakpoints.tablet);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe("tablet");

    act(() => {
      setWidth(breakpoints.desktop + 200);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe("desktop");
  });

  it("is SSR-safe: renders undefined before mount", () => {
    function Probe(): ReactElement {
      const bp = useBreakpoint();
      return <span data-testid="bp">{bp ?? "ssr-unknown"}</span>;
    }
    const html = renderToString(<Probe />);
    expect(html).toContain("ssr-unknown");
  });
});
