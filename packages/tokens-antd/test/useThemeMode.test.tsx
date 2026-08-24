// @vitest-environment jsdom
/**
 * `useThemeMode` is the subscription the nine copied `theme.tsx` files never
 * had: it reads the document's live `data-theme` on the first render and
 * follows it when it changes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";
import { subscribeThemeMode, useThemeMode } from "../src/skin.js";
import { setDocumentTheme } from "./env.js";

afterEach(async () => {
  cleanup();
  await setDocumentTheme(null);
});

describe("useThemeMode", () => {
  it("reads the document's data-theme on the very first render", async () => {
    await setDocumentTheme("dark");
    const seen: string[] = [];
    function Probe(): ReactElement {
      const mode = useThemeMode();
      seen.push(mode);
      return <span data-testid="mode">{mode}</span>;
    }
    render(<Probe />);
    expect(seen[0]).toBe("dark");
    expect(screen.getByTestId("mode").textContent).toBe("dark");
  });

  it("follows a runtime toggle in both directions", async () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe("light");
    await setDocumentTheme("dark");
    expect(result.current).toBe("dark");
    await setDocumentTheme("light");
    expect(result.current).toBe("light");
  });

  it("treats a removed or foreign attribute as light — tokens.css' :root default", async () => {
    await setDocumentTheme("dark");
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe("dark");
    await setDocumentTheme(null);
    expect(result.current).toBe("light");
  });

  it("is SSR-safe: light where there is no document", () => {
    function Probe(): ReactElement {
      return <span>{useThemeMode()}</span>;
    }
    expect(renderToString(<Probe />)).toContain("light");
  });

  it("subscribeThemeMode stops notifying after unsubscribe", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeThemeMode(onChange);
    await setDocumentTheme("dark");
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    await setDocumentTheme("light");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
