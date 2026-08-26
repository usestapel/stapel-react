import { describe, expect, it } from "vitest";
import { theme as antdTheme } from "antd";
import { bridgeRadiusRole, colors, radii } from "@stapel/tokens";
import { toAntdTheme, toAntdThemeConfig } from "../src/index.js";

describe("toAntdTheme — §68 neutral roles → antd theme.token (frontend-guidelines §2.4)", () => {
  it("maps the §2.4 table roles to antd field names for light", () => {
    const t = toAntdTheme("light");
    expect(t.colorPrimary).toBe(colors.brand.light);
    expect(t.colorError).toBe(colors.error.light);
    expect(t.colorSuccess).toBe(colors.success.light);
    expect(t.colorWarning).toBe(colors.warning.light);
    expect(t.colorText).toBe(colors.text.light);
    expect(t.colorTextSecondary).toBe(colors["text-muted"].light);
    expect(t.colorTextTertiary).toBe(colors["text-subtle"].light);
    expect(t.colorBgContainer).toBe(colors["surface-raised"].light);
    expect(t.colorBgLayout).toBe(colors.surface.light);
    expect(t.colorBgElevated).toBe(colors["surface-overlay"].light);
    expect(t.colorBorder).toBe(colors.border.light);
    expect(t.colorBorderSecondary).toBe(colors["border-subtle"].light);
    expect(t.colorLink).toBe(colors.link.light);
    expect(t.colorLinkHover).toBe(colors["link-hover"].light);
    expect(t.borderRadius).toBe(radii[bridgeRadiusRole]);
  });

  it("picks the dark half of every colour pair for mode='dark'", () => {
    const light = toAntdTheme("light");
    const dark = toAntdTheme("dark");
    expect(dark.colorPrimary).toBe(colors.brand.dark);
    expect(dark.colorBgContainer).toBe(colors["surface-raised"].dark);
    // Every colour field differs between the two modes (theme actually switches).
    expect(dark.colorPrimary).not.toBe(light.colorPrimary);
    expect(dark.colorText).not.toBe(light.colorText);
    expect(dark.colorBgLayout).not.toBe(light.colorBgLayout);
  });

  it("is pure — repeated calls are structurally equal", () => {
    expect(toAntdTheme("light")).toEqual(toAntdTheme("light"));
  });
});

describe("toAntdThemeConfig — full ThemeConfig with the mode algorithm", () => {
  it("carries the token plus a light/dark algorithm", () => {
    const light = toAntdThemeConfig("light");
    const dark = toAntdThemeConfig("dark");
    expect(light.token).toEqual(toAntdTheme("light"));
    expect(typeof light.algorithm).toBe("function");
    expect(typeof dark.algorithm).toBe("function");
    // The two modes carry different algorithms (default vs dark).
    expect(dark.algorithm).not.toBe(light.algorithm);
  });
});

/** WCAG 2.x relative luminance of a `#rrggbb` hex. */
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#rrggbb` hexes. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("status surfaces and the on-accent label (VC-B4 / VC-B2)", () => {
  it.each(["light", "dark"] as const)("fills alerts and tags from the *-bg / *-border roles in %s", (mode) => {
    const t = antdTheme.getDesignToken(toAntdThemeConfig(mode));
    expect(t.colorWarningBg).toBe(colors["warning-bg"][mode]);
    expect(t.colorWarningBorder).toBe(colors["warning-border"][mode]);
    expect(t.colorSuccessBg).toBe(colors["success-bg"][mode]);
    expect(t.colorSuccessBorder).toBe(colors["success-border"][mode]);
    expect(t.colorErrorBg).toBe(colors["error-bg"][mode]);
    expect(t.colorErrorBorder).toBe(colors["error-border"][mode]);
    expect(t.colorInfoBg).toBe(colors["info-bg"][mode]);
    expect(t.colorInfoBorder).toBe(colors["info-border"][mode]);
    expect(t.colorPrimaryBg).toBe(colors["brand-subtle"][mode]);
  });

  it.each(["light", "dark"] as const)("keeps every status sentence legible on its own fill in %s (AA)", (mode) => {
    const t = antdTheme.getDesignToken(toAntdThemeConfig(mode));
    expect(contrast(t.colorWarning, t.colorWarningBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colorSuccess, t.colorSuccessBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colorError, t.colorErrorBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colorInfo, t.colorInfoBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colorText, t.colorWarningBg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["light", "dark"] as const)("keeps the label on a primary button at AA in %s", (mode) => {
    const t = antdTheme.getDesignToken(toAntdThemeConfig(mode));
    expect(t.colorTextLightSolid).toBe(colors["text-on-accent"][mode]);
    // antd derives the dark primary fill from the seed (it is not the seed
    // itself), so the assertion is on what a button actually paints.
    expect(contrast(t.colorPrimary, t.colorTextLightSolid)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colorPrimaryHover, t.colorTextLightSolid)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a tooltip's label light in both modes — its fill is the dark spotlight either way", () => {
    for (const mode of ["light", "dark"] as const) {
      const config = toAntdThemeConfig(mode);
      expect(config.components?.Tooltip?.colorTextLightSolid).toBe(colors.text.dark);
    }
  });
});
