import { describe, expect, it } from "vitest";
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  checkContrastPairs,
  // @ts-expect-error — .mjs has no type declarations; it's a build/gen tool.
} from "../src/gen/contrast.mjs";

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
  it("reports a failure record when an intentional pair falls below its WCAG threshold", () => {
    const resolvedCore = {
      text: { light: "#d9dde3", dark: "#f4f5f7" }, // fails vs both surfaces
      surface: { light: "#ffffff", dark: "#151a23" },
    };
    const failures = checkContrastPairs(resolvedCore);
    const hit = failures.find(
      (f: { message: string }) => f.message.includes("text на surface (light)")
    );
    expect(hit).toBeDefined();
    expect(hit.fgName).toBe("text");
    expect(hit.bgName).toBe("surface");
    expect(hit.mode).toBe("light");
    expect(hit.key).toBe("text:surface:light");
  });

  it("returns no failures when the pair clears the threshold", () => {
    const resolvedCore = {
      text: { light: "#151a23", dark: "#f4f5f7" },
      surface: { light: "#ffffff", dark: "#0b0e14" },
    };
    const failures = checkContrastPairs(resolvedCore);
    expect(failures).toEqual([]);
  });

  it("skips pairs where a role is absent from the theme (custom/host themes needn't define the whole dictionary)", () => {
    const failures = checkContrastPairs({ text: { light: "#fff", dark: "#000" } });
    expect(failures).toEqual([]);
  });

  it("skips non-hex resolved values (e.g. a custom host role resolved to rgba) instead of failing", () => {
    const resolvedCore = {
      "surface-overlay": { light: "rgba(15, 18, 24, 0.45)", dark: "rgba(0, 0, 0, 0.6)" },
      surface: { light: "#ffffff", dark: "#151a23" },
    };
    // "surface-overlay" isn't in CONTRAST_PAIRS at all, but this also documents
    // that a non-hex value would resolve to a null ratio (skipped), not a crash.
    expect(() => checkContrastPairs(resolvedCore)).not.toThrow();
    expect(checkContrastPairs(resolvedCore)).toEqual([]);
  });

  it("does not check border/border-subtle against surfaces (decorative role-category exemption, §68 Ф6)", () => {
    // A theme where the decorative border roles are badly low-contrast but
    // everything else (incl. focus-ring, which IS still gated) is fine.
    const resolvedCore = {
      surface: { light: "#ffffff", dark: "#151a23" },
      "surface-sunken": { light: "#f4f5f7", dark: "#151a23" },
      border: { light: "#fefefe", dark: "#161c25" }, // ~1:1, would fail 3:1 if checked
      "border-subtle": { light: "#fcfcfc", dark: "#141a22" }, // ~1:1
      "focus-ring": { light: "#4657d9", dark: "#98a5fa" }, // legible, still checked
    };
    const failures = checkContrastPairs(resolvedCore);
    expect(failures.some((f: { fgName: string }) => f.fgName === "border")).toBe(false);
    expect(failures.some((f: { fgName: string }) => f.fgName === "border-subtle")).toBe(
      false
    );
  });
});
