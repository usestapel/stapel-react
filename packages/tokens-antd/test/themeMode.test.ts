// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { colors } from "@stapel/tokens";
import { resolveThemeMode, toAntdTheme, toAntdThemeConfig } from "../src/index.js";

/**
 * The bridge must never blend modes (owner report 2026-08-09). The live
 * `--stapel-<role>` custom properties are the DOCUMENT's mode — they resolve
 * through whichever `data-theme` is active — so handing them out for a
 * different requested `mode` welds antd's light algorithm to the host's dark
 * values. Measured on the live sandbox: `--ant-color-error-bg: #fff2f0`
 * (light-derived, near-white) under `--ant-color-text: #f4f5f7` (live dark,
 * near-white) — an unreadable error Alert at 1.00:1.
 *
 * jsdom resolves neither custom properties nor a `[data-theme]` rule through
 * `getComputedStyle` (see `toAntdThemeLiveCss.test.ts` for the same gap), so
 * the host's `tokens.css` is stood in for by stubbing the one call the bridge
 * makes; the attribute itself is set for real, since that is what
 * `resolveThemeMode` reads.
 */
const LIVE_DARK_BRAND = "#98a5fa";

function installDarkDocument(): void {
  document.documentElement.setAttribute("data-theme", "dark");
  vi.stubGlobal(
    "getComputedStyle",
    vi.fn().mockReturnValue({
      getPropertyValue: (property: string) =>
        property === "--stapel-brand" ? LIVE_DARK_BRAND : "",
    } as unknown as CSSStyleDeclaration)
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("resolveThemeMode", () => {
  it("reads the host's data-theme attribute", () => {
    expect(resolveThemeMode()).toBe("light");
    document.documentElement.setAttribute("data-theme", "dark");
    expect(resolveThemeMode()).toBe("dark");
  });

  it("treats anything other than an explicit dark as light — tokens.css' :root default", () => {
    document.documentElement.setAttribute("data-theme", "solarized");
    expect(resolveThemeMode()).toBe("light");
  });

  it("ignores prefers-color-scheme — tokens.css ships no media query to agree with it", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, media: "(prefers-color-scheme: dark)" })
    );
    expect(resolveThemeMode()).toBe("light");
  });
});

describe("toAntdTheme — never blends the document's mode with the requested one", () => {
  it("serves the live custom property when the document IS in that mode", () => {
    installDarkDocument();
    expect(toAntdTheme("dark").colorPrimary).toBe(LIVE_DARK_BRAND);
  });

  it("falls back to the compiled default when the document is in the OTHER mode", () => {
    installDarkDocument();
    // Not LIVE_DARK_BRAND: a light theme must not be built out of dark values.
    expect(toAntdTheme("light").colorPrimary).toBe(colors.brand.light);
  });

  it("defaults `mode` to the document's, so an unargumented call self-themes", () => {
    installDarkDocument();
    expect(toAntdTheme().colorPrimary).toBe(LIVE_DARK_BRAND);
    expect(toAntdTheme().colorText).toBe(colors.text.dark);
    expect(toAntdThemeConfig().token?.colorBgContainer).toBe(colors["surface-raised"].dark);
  });

  it("keeps the algorithm on the same side as the values", () => {
    installDarkDocument();
    // The regression that produced the unreadable Alert was exactly this pair
    // disagreeing: a light algorithm over dark text. Both sides are read off
    // one `mode`, so asserting the values is asserting the algorithm's input.
    const light = toAntdTheme("light");
    const dark = toAntdTheme("dark");
    expect(light.colorText).toBe(colors.text.light);
    expect(dark.colorText).toBe(colors.text.dark);
    expect(light.colorBgContainer).toBe(colors["surface-raised"].light);
    expect(dark.colorBgContainer).toBe(colors["surface-raised"].dark);
  });
});
