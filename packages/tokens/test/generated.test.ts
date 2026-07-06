import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  colors,
  componentTokens,
  cssVar,
  breakpoints,
  breakpointForWidth,
  mediaQuery,
  elevation,
  spacing,
  radii,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(here, "..", p), "utf8");

describe("generated tokens.css (committed artifact)", () => {
  const css = read("src/generated/tokens.css");

  it("has :root and [data-theme=\"dark\"] blocks", () => {
    expect(css).toContain(":root {");
    expect(css).toContain('[data-theme="dark"] {');
  });

  it("emits every core token in both themes as --stapel-color-*", () => {
    const [root = "", dark = ""] = css.split('[data-theme="dark"]');
    for (const [name, pair] of Object.entries(colors)) {
      expect(root, name).toContain(`--stapel-color-${name}: ${pair.light};`);
      expect(dark, name).toContain(`--stapel-color-${name}: ${pair.dark};`);
    }
  });

  it("emits every component token as a theme-invariant var() ref in :root only", () => {
    const [root = "", dark = ""] = css.split('[data-theme="dark"]');
    for (const [name, ref] of Object.entries(componentTokens)) {
      expect(root, name).toContain(`--stapel-${name}: var(--stapel-color-${ref});`);
      expect(dark, name).not.toContain(`--stapel-${name}:`);
    }
  });

  it("never exposes raw ramps as a CSS API (hex lives only inside L2 values)", () => {
    expect(css).not.toContain("--stapel-raw-");
    expect(css).not.toMatch(/--stapel-color-(gray|brand|blue|red|green|amber)-\d/);
  });

  it("is deterministic / has no unresolved artifacts", () => {
    expect(css).not.toContain("undefined");
    expect(css).not.toContain("NaN");
    expect(css.endsWith("\n")).toBe(true);
  });

  it("carries the non-colour scales", () => {
    expect(css).toContain("--stapel-space-4: 16px;");
    expect(css).toContain("--stapel-radius-md: 8px;");
    expect(css).toContain("--stapel-elevation-low:");
    expect(css).toContain("--stapel-font-size-md: 16px;");
  });
});

describe("raw ramps are NOT in the main entry (subpath-only)", () => {
  it("dist barrel does not re-export ramps", async () => {
    const mod = await import("../src/index.js");
    expect("ramps" in mod).toBe(false);
  });
});

describe("typed public surface", () => {
  it("cssVar renders a var() reference", () => {
    expect(cssVar("color-accent")).toBe("var(--stapel-color-accent)");
    expect(cssVar("button-primary-bg")).toBe("var(--stapel-button-primary-bg)");
  });

  it("colors are {light,dark} pairs of resolved values", () => {
    for (const [name, pair] of Object.entries(colors)) {
      expect(pair.light, `${name}.light`).toBeTypeOf("string");
      expect(pair.dark, `${name}.dark`).toBeTypeOf("string");
    }
  });

  it("component tokens each reference exactly one core token", () => {
    for (const [name, ref] of Object.entries(componentTokens)) {
      expect(name in colors, `${name} should not collide with core`).toBe(false);
      expect(ref in colors, `${name} → ${ref}`).toBe(true);
    }
  });

  it("scales survived the theme.json migration", () => {
    expect(spacing["4"]).toBe(16);
    expect(radii.md).toBe(8);
    expect(elevation.low.light).toContain("rgba");
  });
});

describe("breakpoints (values generated, helpers hand-written)", () => {
  it("has exactly the three canonical breakpoints", () => {
    expect(Object.keys(breakpoints).sort()).toEqual(["desktop", "phone", "tablet"]);
    expect(breakpoints.phone).toBe(0);
    expect(breakpoints.tablet).toBeGreaterThan(breakpoints.phone);
    expect(breakpoints.desktop).toBeGreaterThan(breakpoints.tablet);
  });

  it("resolves widths and renders media queries", () => {
    expect(breakpointForWidth(0)).toBe("phone");
    expect(breakpointForWidth(breakpoints.tablet)).toBe("tablet");
    expect(breakpointForWidth(breakpoints.desktop)).toBe("desktop");
    expect(mediaQuery("tablet")).toBe("(min-width: 768px)");
  });
});
