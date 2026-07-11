import { describe, expect, it } from "vitest";
import {
  bridgeColorRoles,
  bridgeRadiusRole,
  colors,
  radii,
} from "@stapel/tokens";
import { toMuiTheme } from "../src/index.js";

describe("toMuiTheme — L2 core tokens → MUI theme (frontend-guidelines §2.4)", () => {
  it("maps the §2.4 table roles to MUI palette fields for light", () => {
    const t = toMuiTheme("light");
    expect(t.palette.mode).toBe("light");
    expect(t.palette.primary.main).toBe(colors[bridgeColorRoles.brand].light);
    expect(t.palette.error.main).toBe(colors[bridgeColorRoles.danger].light);
    expect(t.palette.success.main).toBe(colors[bridgeColorRoles.success].light);
    expect(t.palette.warning.main).toBe(colors[bridgeColorRoles.warning].light);
    expect(t.palette.text.primary).toBe(colors[bridgeColorRoles.textPrimary].light);
    expect(t.palette.background.paper).toBe(colors[bridgeColorRoles.bgContainer].light);
    expect(t.palette.background.default).toBe(colors[bridgeColorRoles.bgLayout].light);
    expect(t.shape.borderRadius).toBe(radii[bridgeRadiusRole]);
  });

  it("picks the dark half of every colour pair for mode='dark'", () => {
    const light = toMuiTheme("light");
    const dark = toMuiTheme("dark");
    expect(dark.palette.mode).toBe("dark");
    expect(dark.palette.primary.main).toBe(colors[bridgeColorRoles.brand].dark);
    expect(dark.palette.background.paper).toBe(
      colors[bridgeColorRoles.bgContainer].dark
    );
    expect(dark.palette.primary.main).not.toBe(light.palette.primary.main);
    expect(dark.palette.text.primary).not.toBe(light.palette.text.primary);
    expect(dark.palette.background.default).not.toBe(
      light.palette.background.default
    );
  });
});
