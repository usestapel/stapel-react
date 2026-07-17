// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgeColorRoles, colors } from "@stapel/tokens";
import { toAntdTheme } from "../src/index.js";

/**
 * Owner audit 2026-07-17 (§54 root cause): a host that customizes its brand
 * colour does it by regenerating ITS OWN `tokens.css` (`@stapel/tokens`
 * README — copy `theme.default.json` to `stapel.theme.json`, edit the
 * `ramps`, `pnpm gen:tokens`) — never by touching this published package.
 * The bridge must read that host's LIVE `--stapel-color-*` custom
 * properties at call time, not the compiled-in `colors` snapshot of
 * `@stapel/tokens`' OWN default theme, or every default skin renders
 * Stapel's stock colour forever regardless of what any host configures
 * (this was the actual bug behind a live report: a deployment's custom
 * brand colour never showed up in any default skin, which kept rendering
 * Stapel's own stock purple instead).
 *
 * `environment: "node"` (this package's default, see vitest.config.ts) has
 * no `document`, so this file opts into jsdom on its own to exercise the
 * live-DOM branch; `toAntdTheme.test.ts` covers the no-DOM fallback branch
 * under the default node environment.
 *
 * jsdom's own CSS engine doesn't resolve custom properties through
 * `getComputedStyle` (neither via inline `style.setProperty` nor via an
 * actual `<style>` stylesheet rule — a long-standing jsdom limitation, not a
 * real-browser one), so `window.getComputedStyle` is stubbed directly here
 * to exercise exactly the call the implementation makes
 * (`getComputedStyle(document.documentElement).getPropertyValue(...)`) — a
 * real browser resolves the same property off a host's regenerated
 * `tokens.css` with zero code difference.
 */
function stubComputedColorAccent(hex: string | undefined): void {
  vi.stubGlobal(
    "getComputedStyle",
    vi.fn().mockReturnValue({
      getPropertyValue: (prop: string) =>
        prop === "--stapel-color-accent" && hex !== undefined ? hex : "",
    } as CSSStyleDeclaration)
  );
}

describe("toAntdTheme — reads the host's live CSS custom properties", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers a live --stapel-color-accent over the compiled-in default", () => {
    stubComputedColorAccent("#1677ff");
    expect(toAntdTheme("light").colorPrimary).toBe("#1677ff");
  });

  it("falls back to the compiled-in default when the host never set the var", () => {
    stubComputedColorAccent(undefined);
    expect(toAntdTheme("light").colorPrimary).toBe(colors[bridgeColorRoles.brand].light);
  });

  it("re-derives per call — a live change is picked up without re-mounting anything", () => {
    stubComputedColorAccent(undefined);
    expect(toAntdTheme("light").colorPrimary).toBe(colors[bridgeColorRoles.brand].light);
    stubComputedColorAccent("#ff4d4f");
    expect(toAntdTheme("light").colorPrimary).toBe("#ff4d4f");
  });
});
