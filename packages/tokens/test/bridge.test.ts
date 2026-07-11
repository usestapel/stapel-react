import { describe, expect, it } from "vitest";
import {
  bridgeColorRoles,
  bridgeFontSizeRole,
  bridgeRadiusRole,
  colors,
  fontSize,
  radii,
} from "../src/index.js";

describe("bridgeColorRoles — the one L2 → design-system role mapping table", () => {
  it("every role points at a real L2 core token with a light/dark pair", () => {
    for (const [role, tokenName] of Object.entries(bridgeColorRoles)) {
      const pair = (colors as Record<string, { light: string; dark: string }>)[
        tokenName
      ];
      expect(pair, `role "${role}" → unknown core token "${tokenName}"`).toBeDefined();
      expect(typeof pair.light).toBe("string");
      expect(typeof pair.dark).toBe("string");
    }
  });

  it("covers the roles frontend-guidelines §2.4 names explicitly", () => {
    const required: (keyof typeof bridgeColorRoles)[] = [
      "brand",
      "success",
      "danger",
      "warning",
      "bgContainer",
      "bgLayout",
      "textPrimary",
    ];
    for (const role of required) {
      expect(bridgeColorRoles[role]).toBeDefined();
    }
  });
});

describe("bridgeRadiusRole / bridgeFontSizeRole — the single non-colour bridge roles", () => {
  it("resolve to real scale entries", () => {
    expect(radii[bridgeRadiusRole]).toBeTypeOf("number");
    expect(fontSize[bridgeFontSizeRole].fontSize).toBeTypeOf("number");
  });
});
