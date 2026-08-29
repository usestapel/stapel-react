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
import {
  subscribeHostBrand,
  subscribeThemeMode,
  useHostBrand,
  useThemeMode,
} from "../src/skin.js";
import { setDocumentBrand, setDocumentTheme } from "./env.js";

afterEach(async () => {
  cleanup();
  await setDocumentTheme(null);
  await setDocumentBrand(null);
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

/**
 * `data-brand` is the second attribute `@stapel/tokens`' generated
 * `tokens.css` keys on (`:root[data-brand="…"]`), and it moves the same live
 * `--stapel-<role>` values `data-theme` does. A multibrand host writes it
 * once it knows which site it is serving, i.e. after first paint, so it is a
 * live signal and not a boot-time constant.
 */
describe("useHostBrand", () => {
  it("reads the document's data-brand on the very first render", async () => {
    await setDocumentBrand("northgate");
    const seen: string[] = [];
    function Probe(): ReactElement {
      const brand = useHostBrand();
      seen.push(brand);
      return <span data-testid="brand">{brand}</span>;
    }
    render(<Probe />);
    expect(seen[0]).toBe("northgate");
    expect(screen.getByTestId("brand").textContent).toBe("northgate");
  });

  it("follows a runtime stamp, a swap, and a removal", async () => {
    const { result } = renderHook(() => useHostBrand());
    expect(result.current).toBe("");
    await setDocumentBrand("northgate");
    expect(result.current).toBe("northgate");
    await setDocumentBrand("eastvale");
    expect(result.current).toBe("eastvale");
    await setDocumentBrand(null);
    expect(result.current).toBe("");
  });

  it("is SSR-safe: no scope where there is no document", () => {
    function Probe(): ReactElement {
      return <span>brand:{useHostBrand()}</span>;
    }
    expect(renderToString(<Probe />)).toContain("brand:");
  });

  it("subscribeHostBrand stops notifying after unsubscribe", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeHostBrand(onChange);
    await setDocumentBrand("northgate");
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    await setDocumentBrand("eastvale");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("the two attributes do not wake each other's subscribers", async () => {
    const onTheme = vi.fn();
    const onBrand = vi.fn();
    const stopTheme = subscribeThemeMode(onTheme);
    const stopBrand = subscribeHostBrand(onBrand);
    await setDocumentBrand("northgate");
    expect(onBrand).toHaveBeenCalledTimes(1);
    expect(onTheme).not.toHaveBeenCalled();
    await setDocumentTheme("dark");
    expect(onTheme).toHaveBeenCalledTimes(1);
    expect(onBrand).toHaveBeenCalledTimes(1);
    stopTheme();
    stopBrand();
  });
});
