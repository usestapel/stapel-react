import { describe, expect, it } from "vitest";
import { colors, elevation, breakpoints, breakpointForWidth, mediaQuery } from "../src/index.js";

describe("color tokens", () => {
  it("every color token has a light/dark pair", () => {
    for (const [name, token] of Object.entries(colors)) {
      expect(token.light, `colors.${name}.light`).toBeTypeOf("string");
      expect(token.light.length, `colors.${name}.light`).toBeGreaterThan(0);
      expect(token.dark, `colors.${name}.dark`).toBeTypeOf("string");
      expect(token.dark.length, `colors.${name}.dark`).toBeGreaterThan(0);
    }
  });

  it("every elevation token has a light/dark pair", () => {
    for (const [name, token] of Object.entries(elevation)) {
      expect(token.light, `elevation.${name}`).toBeTypeOf("string");
      expect(token.dark, `elevation.${name}`).toBeTypeOf("string");
    }
  });
});

describe("breakpoints", () => {
  it("has exactly the three canonical breakpoints", () => {
    expect(Object.keys(breakpoints).sort()).toEqual([
      "desktop",
      "phone",
      "tablet",
    ]);
    expect(breakpoints.phone).toBe(0);
    expect(breakpoints.tablet).toBeGreaterThan(breakpoints.phone);
    expect(breakpoints.desktop).toBeGreaterThan(breakpoints.tablet);
  });

  it("resolves widths to breakpoints", () => {
    expect(breakpointForWidth(0)).toBe("phone");
    expect(breakpointForWidth(breakpoints.tablet - 1)).toBe("phone");
    expect(breakpointForWidth(breakpoints.tablet)).toBe("tablet");
    expect(breakpointForWidth(breakpoints.desktop - 1)).toBe("tablet");
    expect(breakpointForWidth(breakpoints.desktop)).toBe("desktop");
    expect(breakpointForWidth(5000)).toBe("desktop");
  });

  it("renders min-width media queries", () => {
    expect(mediaQuery("tablet")).toBe("(min-width: 768px)");
  });
});
