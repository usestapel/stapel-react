// @vitest-environment jsdom
/**
 * Control SHAPE as a host token axis (owner escalation 2026-09-02).
 *
 * The bridge already reads every COLOUR role live off the host's
 * `--stapel-*` custom properties (`readLiveCssVar`); the control shape —
 * border radius, font size, control height — was compiled in, so a host
 * that regenerated its `tokens.css` with a rounder radius or a taller
 * control still got this package's frozen snapshot in every antd control.
 *
 * §68 rule: ONE dictionary. The radius and font-size axes already exist
 * (`--stapel-radius-md` / `--stapel-font-size-md` — the bridge roles), so
 * the bridge now reads THOSE live rather than minting `--stapel-control-*`
 * twins for them. Control height had no axis at all, so the dictionary
 * grew one (`scales.controls` → `--stapel-control-height` +
 * `--stapel-control-height-phone`), emitted by the same generator as every
 * other scale.
 *
 * Absent properties = today's exact values: radius 8, font size 16, control
 * height 32 (antd's own seed), phone floor 44.
 *
 * jsdom's `getComputedStyle` does not resolve custom properties (see
 * `toAntdThemeLiveCss.test.ts`), so the document-root scope is stubbed to
 * answer exactly the property reads the implementation performs.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { theme as antdTheme } from "antd";
import { toAntdTheme, toAntdThemeConfig } from "../src/index.js";
import { PHONE_CONTROL_HEIGHT, SkinTheme } from "../src/skin.js";
import { installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

/** Serve `vars` for the DOCUMENT ROOT's computed style; everything else gets
 * the real jsdom answer (antd internals may measure other elements). */
function stubRootVars(vars: Readonly<Record<string, string>>): void {
  const orig = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", ((el: Element, pseudo?: string | null) => {
    const style = orig(el, pseudo ?? undefined);
    if (el !== document.documentElement) return style;
    return {
      getPropertyValue: (prop: string) =>
        vars[prop] ?? style.getPropertyValue(prop),
    } as CSSStyleDeclaration;
  }) as typeof window.getComputedStyle);
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  resetViewportListeners();
});

describe("toAntdTheme — the control shape reads the live axis", () => {
  it("absent properties yield today's exact values (radius 8, font 16, height 32)", () => {
    stubRootVars({});
    const token = toAntdTheme("light");
    expect(token.borderRadius).toBe(8);
    expect(token.fontSize).toBe(16);
    expect(token.controlHeight).toBe(32);
  });

  it("prefers the live radius/font-size roles the dictionary already has", () => {
    stubRootVars({
      "--stapel-radius-md": "2px",
      "--stapel-font-size-md": "15px",
    });
    const token = toAntdTheme("light");
    expect(token.borderRadius).toBe(2);
    expect(token.fontSize).toBe(15);
  });

  it("prefers a live --stapel-control-height, through toAntdThemeConfig too", () => {
    stubRootVars({ "--stapel-control-height": "40px" });
    expect(toAntdTheme("light").controlHeight).toBe(40);
    expect(toAntdThemeConfig("light").token?.controlHeight).toBe(40);
  });

  it("ignores a malformed value and keeps the compiled-in default", () => {
    stubRootVars({ "--stapel-control-height": "tall" });
    expect(toAntdTheme("light").controlHeight).toBe(32);
  });
});

/** Reads the applied antd tokens under the nearest ConfigProvider. */
function TokenProbe(): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <div
      data-testid="control-probe"
      data-control-height={token.controlHeight}
      data-control-height-sm={token.controlHeightSM}
    />
  );
}

describe("SkinTheme — the phone floor reads --stapel-control-height-phone", () => {
  it("applies the live phone height to controlHeight AND controlHeightSM", () => {
    installMatchMedia();
    setViewport(390);
    stubRootVars({ "--stapel-control-height-phone": "48px" });
    render(
      <SkinTheme>
        <TokenProbe />
      </SkinTheme>
    );
    const probe = screen.getByTestId("control-probe");
    expect(probe.getAttribute("data-control-height")).toBe("48");
    expect(probe.getAttribute("data-control-height-sm")).toBe("48");
  });

  it("absent property → the 44px floor, exactly as before", () => {
    installMatchMedia();
    setViewport(390);
    stubRootVars({});
    render(
      <SkinTheme>
        <TokenProbe />
      </SkinTheme>
    );
    const probe = screen.getByTestId("control-probe");
    expect(probe.getAttribute("data-control-height")).toBe(
      String(PHONE_CONTROL_HEIGHT)
    );
    expect(PHONE_CONTROL_HEIGHT).toBe(44);
  });
});
