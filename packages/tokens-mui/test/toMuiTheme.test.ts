import { describe, expect, it } from "vitest";
import { bridgeRadiusRole, colors, radii } from "@stapel/tokens";
import { toMuiTheme } from "../src/index.js";

describe("toMuiTheme — §68 neutral roles → MUI theme (frontend-guidelines §2.4)", () => {
  it("maps the §2.4 table roles to MUI palette fields for light", () => {
    const t = toMuiTheme("light");
    expect(t.palette.mode).toBe("light");
    expect(t.palette.primary.main).toBe(colors.brand.light);
    expect(t.palette.primary.dark).toBe(colors["brand-active"].light);
    expect(t.palette.primary.contrastText).toBe(colors["text-on-accent"].light);
    expect(t.palette.error.main).toBe(colors.error.light);
    expect(t.palette.success.main).toBe(colors.success.light);
    expect(t.palette.warning.main).toBe(colors.warning.light);
    expect(t.palette.text.primary).toBe(colors.text.light);
    expect(t.palette.text.secondary).toBe(colors["text-muted"].light);
    expect(t.palette.text.disabled).toBe(colors["text-subtle"].light);
    expect(t.palette.background.paper).toBe(colors["surface-raised"].light);
    expect(t.palette.background.default).toBe(colors.surface.light);
    expect(t.palette.divider).toBe(colors.border.light);
    expect(t.shape.borderRadius).toBe(radii[bridgeRadiusRole]);
  });

  it("picks the dark half of every colour pair for mode='dark'", () => {
    const light = toMuiTheme("light");
    const dark = toMuiTheme("dark");
    expect(dark.palette.mode).toBe("dark");
    expect(dark.palette.primary.main).toBe(colors.brand.dark);
    expect(dark.palette.background.paper).toBe(colors["surface-raised"].dark);
    expect(dark.palette.primary.main).not.toBe(light.palette.primary.main);
    expect(dark.palette.text.primary).not.toBe(light.palette.text.primary);
    expect(dark.palette.background.default).not.toBe(
      light.palette.background.default
    );
  });
});
