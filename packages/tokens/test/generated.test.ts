import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  colors,
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

describe("generated tokens.css (committed artifact — the stable core, §68)", () => {
  const css = read("src/generated/tokens.css");

  it("has :root and [data-theme=\"dark\"] blocks", () => {
    expect(css).toContain(":root {");
    expect(css).toContain('[data-theme="dark"] {');
  });

  it("emits every role in both themes as --stapel-<role>", () => {
    const [root = "", dark = ""] = css.split('[data-theme="dark"]');
    for (const [name, pair] of Object.entries(colors)) {
      expect(root, name).toContain(`--stapel-${name}: ${pair.light};`);
      expect(dark, name).toContain(`--stapel-${name}: ${pair.dark};`);
    }
  });

  it("never exposes raw ramps as a CSS API (hex lives only inside role values)", () => {
    expect(css).not.toContain("--stapel-raw-");
    expect(css).not.toMatch(/--stapel-(gray|brand|blue|red|green|amber)-\d/);
  });

  it("never emits an -rgb triplet (that's the tailwind@3 adapter's job, not the core)", () => {
    expect(css).not.toMatch(/-rgb/);
  });

  it("never emits an old ad-hoc §68-superseded name", () => {
    for (const stale of ["--stapel-color-accent", "--stapel-upperground", "background-primary"]) {
      expect(css).not.toContain(stale);
    }
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

describe("generated tailwind.css (tailwind@4 — default adapter)", () => {
  const css = read("src/generated/tailwind.css");

  it("is an @theme block with no RGB triplets (§68 Ф1 gate)", () => {
    expect(css).toContain("@theme {");
    expect(css).not.toMatch(/-rgb/);
  });

  it("maps every role to a --color-<role> var referencing the stable core", () => {
    for (const name of Object.keys(colors)) {
      expect(css, name).toContain(`--color-${name}: var(--stapel-${name});`);
    }
  });
});

describe("generated tailwind-v3.css / tailwind-v3.config.cjs (legacy adapter, owned in-bin)", () => {
  const css = read("src/generated/tailwind-v3.css");
  const config = read("src/generated/tailwind-v3.config.cjs");

  it("carries RGB triplets — legitimate here, this is the v3 adapter", () => {
    expect(css).toMatch(/-rgb/);
    for (const name of Object.keys(colors)) {
      expect(css, name).toContain(`--stapel-${name}-rgb:`);
    }
  });

  it("the config snippet references the triplets via rgb(var(..)/<alpha>)", () => {
    expect(config).toContain("module.exports");
    expect(config).toContain("rgb(var(--stapel-brand-rgb) / <alpha-value>)");
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
    expect(cssVar("brand")).toBe("var(--stapel-brand)");
    expect(cssVar("surface-raised")).toBe("var(--stapel-surface-raised)");
  });

  it("colors are {light,dark} pairs of resolved values", () => {
    for (const [name, pair] of Object.entries(colors)) {
      expect(pair.light, `${name}.light`).toBeTypeOf("string");
      expect(pair.dark, `${name}.dark`).toBeTypeOf("string");
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
