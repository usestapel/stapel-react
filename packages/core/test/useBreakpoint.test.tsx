import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("is right on the very FIRST client render — no undefined frame", () => {
    // The AppShell flash: an effect-driven hook painted the phone drawer on a
    // desktop for one frame. Capture every value the component ever rendered
    // with; the first one must already be the real breakpoint.
    setWidth(breakpoints.desktop + 100);
    const seen: Array<string | undefined> = [];
    function Probe(): ReactElement {
      const bp = useBreakpoint();
      seen.push(bp);
      return <span>{bp}</span>;
    }
    render(<Probe />);
    expect(seen[0]).toBe("desktop");
    expect(seen).not.toContain(undefined);
  });

  it("also listens on the breakpoint media queries where matchMedia exists", () => {
    // Keyed by query: the hook subscribes ONE callback to both edge lists, so
    // a Set of functions would collapse the two subscriptions into one entry.
    const listeners = new Map<string, () => void>();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, l: () => void) => listeners.set(query, l),
      removeEventListener: () => listeners.delete(query),
    }));
    setWidth(500);
    const { result, unmount } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("phone");
    // One subscription per edge query (tablet, desktop).
    expect([...listeners.keys()]).toEqual([
      `(min-width: ${String(breakpoints.tablet)}px)`,
      `(min-width: ${String(breakpoints.desktop)}px)`,
    ]);
    act(() => {
      setWidth(breakpoints.desktop);
      for (const l of [...listeners.values()]) l();
    });
    expect(result.current).toBe("desktop");
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("tolerates a matchMedia double without the listener API", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    setWidth(500);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("phone");
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
