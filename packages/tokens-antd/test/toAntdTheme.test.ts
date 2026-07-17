import { describe, expect, it } from "vitest";
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
