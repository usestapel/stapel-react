import { describe, expect, it } from "vitest";
import { colors, bridgeFontSizeRole, bridgeRadiusRole, fontSize, radii } from "../src/index.js";

// §68: the neutral colour-role dictionary IS the bridge vocabulary now — a
// design-system bridge (tokens-antd, tokens-mui) reads `colors["brand"]`,
// `colors["surface-raised"]`, etc. directly. There is no separate role→role
// indirection table to test here anymore (the old `bridgeColorRoles` map is
// gone); this file only covers the two non-colour picks that still need a
// single shared decision so the two bridges cannot silently diverge.
describe("bridgeRadiusRole / bridgeFontSizeRole — the single non-colour bridge roles", () => {
  it("resolve to real scale entries", () => {
    expect(radii[bridgeRadiusRole]).toBeTypeOf("number");
    expect(fontSize[bridgeFontSizeRole].fontSize).toBeTypeOf("number");
  });
});

describe("§68 colour roles a design-system bridge is documented to read", () => {
  it("every role frontend-guidelines §2.4/§68 names explicitly exists with a light/dark pair", () => {
    const required = [
      "brand",
      "brand-hover",
      "brand-active",
      "success",
      "warning",
      "error",
      "info",
      "text",
      "text-muted",
      "text-subtle",
      "text-on-accent",
      "surface",
      "surface-raised",
      "surface-overlay",
      "border",
      "border-subtle",
      "link",
      "link-hover",
    ] as const;
    for (const role of required) {
      const pair = (colors as Record<string, { light: string; dark: string }>)[role];
      expect(pair, `role "${role}" missing from colors`).toBeDefined();
      expect(typeof pair.light).toBe("string");
      expect(typeof pair.dark).toBe("string");
    }
  });
});
