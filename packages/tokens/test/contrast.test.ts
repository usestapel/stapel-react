import { describe, expect, it } from "vitest";
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  checkContrastPairs,
  // @ts-expect-error — .mjs has no type declarations; it's a build/gen tool.
} from "../scripts/contrast.mjs";

describe("hexToRgb", () => {
  it("parses 6-digit and 3-digit hex", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000")).toEqual([0, 0, 0]);
  });

  it("returns null for non-hex colours (rgba/hsla/named/garbage)", () => {
    expect(hexToRgb("rgba(0, 0, 0, 0.5)")).toBeNull();
    expect(hexToRgb("hsl(0, 0%, 0%)")).toBeNull();
    expect(hexToRgb("red")).toBeNull();
    expect(hexToRgb(undefined)).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("white is 1, black is 0", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
  });
});

describe("contrastRatio", () => {
  it("white on black (and vice versa) is the maximum 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("a colour against itself is the minimum 1:1", () => {
    expect(contrastRatio("#7b828f", "#7b828f")).toBeCloseTo(1, 5);
  });

  it("is symmetric — order of fg/bg doesn't matter", () => {
    const a = contrastRatio("#4657d9", "#eef0fd");
    const b = contrastRatio("#eef0fd", "#4657d9");
    expect(a).toBeCloseTo(b as number, 10);
  });

  it("returns null when either side isn't parseable hex", () => {
    expect(contrastRatio("rgba(0,0,0,0.5)", "#ffffff")).toBeNull();
    expect(contrastRatio("#ffffff", "rgba(0,0,0,0.5)")).toBeNull();
  });

  it("flags a known-failing low-contrast pair (light gray on white)", () => {
    // #d9dde3 (a light gray, e.g. gray.300) on #ffffff is well under 4.5:1.
    const ratio = contrastRatio("#d9dde3", "#ffffff") as number;
    expect(ratio).toBeLessThan(4.5);
  });

  it("passes a known-good high-contrast pair (near-black on white)", () => {
    const ratio = contrastRatio("#151a23", "#ffffff") as number; // gray.900 on gray.25
    expect(ratio).toBeGreaterThan(4.5);
  });
});

describe("checkContrastPairs", () => {
  it("warns when an intentional pair falls below its WCAG threshold", () => {
    const resolvedCore = {
      "text-primary": { light: "#d9dde3", dark: "#f4f5f7" }, // fails vs both backgrounds
      "background-primary": { light: "#ffffff", dark: "#151a23" },
    };
    const warnings = checkContrastPairs(resolvedCore);
    expect(
      warnings.some((w: string) => w.includes("text-primary на background-primary (light)"))
    ).toBe(true);
  });

  it("does not warn when the pair clears the threshold", () => {
    const resolvedCore = {
      "text-primary": { light: "#151a23", dark: "#f4f5f7" },
      "background-primary": { light: "#ffffff", dark: "#0b0e14" },
    };
    const warnings = checkContrastPairs(resolvedCore);
    expect(warnings).toEqual([]);
  });

  it("skips pairs where a token is absent from the theme (custom/host themes needn't define the whole grid)", () => {
    const warnings = checkContrastPairs({ "text-primary": { light: "#fff", dark: "#000" } });
    expect(warnings).toEqual([]);
  });

  it("skips non-hex resolved values (e.g. scrim rgba) instead of warning", () => {
    const resolvedCore = {
      overlay: { light: "rgba(15, 18, 24, 0.45)", dark: "rgba(0, 0, 0, 0.6)" },
      "background-primary": { light: "#ffffff", dark: "#151a23" },
    };
    // "overlay" isn't in CONTRAST_PAIRS at all, but this also documents that a
    // non-hex value would resolve to a null ratio (skipped), not a crash.
    expect(() => checkContrastPairs(resolvedCore)).not.toThrow();
    expect(checkContrastPairs(resolvedCore)).toEqual([]);
  });
});
