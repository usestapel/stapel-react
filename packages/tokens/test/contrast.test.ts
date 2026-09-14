import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  checkContrastPairs,
  CONTRAST_PAIRS,
  TEXT_ROLES,
  TEXT_FILL_ROLES,
  UI_ROLES,
  DECORATIVE_ROLES,
  UI_FILL_ROLES,
  // @ts-expect-error — .mjs has no type declarations; it's a build/gen tool.
} from "../src/gen/contrast.mjs";
import {
  mergeRamps,
  validateTheme,
  resolveTheme,
  // @ts-expect-error — .mjs has no type declarations; it's a build/gen tool.
} from "../src/gen/lib.mjs";

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
      (f: { message: string }) => f.message.includes("text on surface (light)")
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

  it("checks border/border-subtle against every surface at 3:1 as DECORATIVE chrome (2026-09-14)", () => {
    const resolvedCore = {
      surface: { light: "#ffffff", dark: "#0b0e14" },
      "surface-raised": { light: "#ffffff", dark: "#1c2230" },
      border: { light: "#fefefe", dark: "#161c25" }, // ~1:1
      "border-subtle": { light: "#fcfcfc", dark: "#141a22" }, // ~1:1
      "focus-ring": { light: "#4657d9", dark: "#98a5fa" }, // legible, still checked
    };
    const failures = checkContrastPairs(resolvedCore);
    const keys = failures.map((f: { key: string }) => f.key);
    const border = failures.find((f: { key: string }) => f.key === "border:surface:light");
    expect(border.kind).toBe("decorative");
    expect(border.threshold).toBe(3);
    expect(border.message).toContain("(WCAG 1.4.11, decorative)");
    expect(keys).toContain("border:surface:light");
    expect(keys).toContain("border:surface-raised:dark");
    expect(keys).toContain("border-subtle:surface:light");
    expect(keys).toContain("border-subtle:surface-raised:dark");
    expect(keys.some((k: string) => k.startsWith("focus-ring:"))).toBe(false);
  });
});

describe("CONTRAST_PAIRS — a cross product, not a hand-picked list (2026-09-14)", () => {
  const pairKeys = new Set(CONTRAST_PAIRS.map(([fg, bg, kind]: string[]) => `${fg}:${bg}:${kind}`));

  it("checks every neutral text role on every fill text sits on, as AA text", () => {
    for (const fg of TEXT_ROLES) {
      for (const bg of TEXT_FILL_ROLES) {
        expect(pairKeys.has(`${fg}:${bg}:text`)).toBe(true);
      }
    }
    expect(TEXT_ROLES).toEqual(["text", "text-muted", "text-subtle", "link", "link-hover"]);
    expect(TEXT_FILL_ROLES).toEqual([
      "surface",
      "surface-raised",
      "surface-sunken",
      "surface-overlay",
      "brand-subtle",
      "success-bg",
      "warning-bg",
      "error-bg",
      "info-bg",
    ]);
  });

  it("checks every chrome role on every surface chrome sits on: focus-ring as ui, borders as decorative, both 3:1", () => {
    for (const fg of UI_ROLES) {
      for (const bg of UI_FILL_ROLES) {
        expect(pairKeys.has(`${fg}:${bg}:ui`)).toBe(true);
      }
    }
    for (const fg of DECORATIVE_ROLES) {
      for (const bg of UI_FILL_ROLES) {
        expect(pairKeys.has(`${fg}:${bg}:decorative`)).toBe(true);
      }
    }
    expect(UI_ROLES).toEqual(["focus-ring"]);
    expect(DECORATIVE_ROLES).toEqual(["border", "border-subtle"]);
    expect(UI_FILL_ROLES).toEqual(["surface", "surface-raised", "surface-sunken", "surface-overlay"]);
  });

  it("keeps the status and accent pairs explicit", () => {
    for (const key of [
      "success:success-bg:text",
      "warning:warning-bg:text",
      "error:error-bg:text",
      "info:info-bg:text",
      "text-on-accent:brand:text",
      "success-on:success:text",
      "warning-on:warning:text",
      "error-on:error:text",
      "info-on:info:text",
    ]) {
      expect(pairKeys.has(key)).toBe(true);
    }
  });

  it("goes red on the dark values a live stand failed on before 2026-09-14 (the pre-fix theme)", () => {
    // The dark column as it shipped in @stapel/tokens <= 0.8.0: text-subtle
    // gray.500, border gray.700, border-subtle gray.800 on surface-raised
    // gray.850. Measured live (video-react) at 4.11 / 1.70 / 1.24 — the
    // hand-picked list had none of these three pairs.
    const preFix = {
      "surface-raised": { light: "#ffffff", dark: "#1c2230" },
      "text-subtle": { light: "#7b828f", dark: "#7b828f" },
      border: { light: "#aeb6c2", dark: "#3d4759" },
      "border-subtle": { light: "#d9dde3", dark: "#2a3242" },
    };
    const byKey = new Map(
      checkContrastPairs(preFix).map((f: { key: string; ratio: number }) => [f.key, f.ratio])
    );
    expect(byKey.get("text-subtle:surface-raised:dark")).toBeCloseTo(4.11, 2);
    expect(byKey.get("border:surface-raised:dark")).toBeCloseTo(1.7, 1);
    expect(byKey.get("border-subtle:surface-raised:dark")).toBeCloseTo(1.24, 2);
  });
});

describe("the shipped default theme under the cross-product gate", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(resolve(here, "..", name), "utf8"));
  const theme = read("theme.default.json") as {
    ramps: Record<string, Record<string, string>>;
    contrastExceptions: { fg: string; bg: string; mode: string }[];
  };
  const ramps = mergeRamps(read("ramps.standard.json"), theme.ramps);

  it("validates with no errors — dark passes on its own values", () => {
    const { errors } = validateTheme(theme, ramps);
    expect(errors).toEqual([]);
  });

  it("carries documented exceptions ONLY for the two decorative border roles in light — every text pair passes on its own", () => {
    expect(theme.contrastExceptions.length).toBeGreaterThan(0);
    for (const exc of theme.contrastExceptions) {
      expect(exc.mode).toBe("light");
      expect(["border", "border-subtle"]).toContain(exc.fg);
      expect(exc.reason).toMatch(/shadow|fill|focus-ring|separator/);
    }
    const { warnings } = validateTheme(theme, ramps);
    expect(warnings.length).toBe(theme.contrastExceptions.length);
    expect(warnings.every((w: string) => w.includes("(light)") && w.includes("decorative"))).toBe(true);
  });

  it("light: text-subtle clears 4.5 on every text fill and stays lighter than text-muted", () => {
    const resolved = resolveTheme(theme, ramps).core;
    for (const bg of TEXT_FILL_ROLES) {
      expect(contrastRatio(resolved["text-subtle"].light, resolved[bg].light)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(resolved["text-muted"].light, resolved.surface.light)).toBeGreaterThan(
      contrastRatio(resolved["text-subtle"].light, resolved.surface.light)
    );
  });

  it("dark: text-subtle clears 4.5 on surface-raised, border and border-subtle clear 3", () => {
    const resolved = resolveTheme(theme, ramps).core;
    const ratio = (fg: string, bg: string): number =>
      contrastRatio(resolved[fg].dark, resolved[bg].dark) as number;
    expect(ratio("text-subtle", "surface-raised")).toBeGreaterThanOrEqual(4.5);
    expect(ratio("border", "surface-raised")).toBeGreaterThanOrEqual(3);
    expect(ratio("border-subtle", "surface-raised")).toBeGreaterThanOrEqual(3);
    // The hierarchy survives: secondary text is still lighter than tertiary,
    // and an outline is still stronger than a divider.
    expect(ratio("text-muted", "surface-raised")).toBeGreaterThan(ratio("text-subtle", "surface-raised"));
    expect(ratio("border", "surface-raised")).toBeGreaterThan(ratio("border-subtle", "surface-raised"));
  });
});
