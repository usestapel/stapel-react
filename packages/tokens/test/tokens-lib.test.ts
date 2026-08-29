import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// The gen engine is plain ESM; the bin (bin/stapel-tokens.mjs) is a thin CLI
// wrapper around it, so the role-dictionary invariants are unit-covered here.
import {
  mergeRamps,
  mergeTheme,
  validateTheme,
  resolveTheme,
  renderCss,
  renderTailwind4,
  renderTailwind3Css,
  renderTailwind3Config,
  // @ts-expect-error — .mjs has no type declarations; it's a build/gen tool.
} from "../src/gen/lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const RAMPS = {
  gray: { "50": "#fafafa", "500": "#7b828f", "900": "#111111" },
  brand: { "300": "#98a5fa", "500": "#4657d9" },
};

function base(overrides: Record<string, unknown> = {}) {
  return {
    core: {
      surface: { light: "gray.50", dark: "gray.900" },
      brand: { light: "brand.500", dark: "brand.300" },
    },
    ...overrides,
  };
}

describe("validateTheme — role invariants", () => {
  it("passes a well-formed theme", () => {
    const { errors } = validateTheme(base(), RAMPS);
    expect(errors).toEqual([]);
  });

  it("errors when a role is missing its dark half (unpaired)", () => {
    const theme = base({
      core: { surface: { light: "gray.50" } },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('role "surface"');
    expect(errors[0]).toContain('missing value for "dark"');
  });

  it("errors when a role ref points at a non-existent ramp step", () => {
    const theme = base({
      core: { brand: { light: "brand.550", dark: "brand.300" } },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('brand".light → "brand.550"');
    expect(errors[0]).toContain("no such step in ramp");
    // teaching message lists the available steps
    expect(errors[0]).toContain("300, 500");
  });

  it("errors when a role ref is a raw hex (hex forbidden in core)", () => {
    const theme = base({
      core: { error: { light: "#c93a3a", dark: "brand.300" } },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors.some((e: string) => e.includes("raw hex is forbidden in the core section"))).toBe(true);
  });
});

describe("resolve + render", () => {
  it("inlines resolved hex for every role in :root + dark block", () => {
    const resolved = resolveTheme(base(), RAMPS);
    const css = renderCss(resolved);
    expect(css).toContain("--stapel-brand: #4657d9;");
    const dark = css.split('[data-theme="dark"]')[1] ?? "";
    expect(dark).toContain("--stapel-brand: #98a5fa;");
  });

  it("never emits raw ramps as CSS custom properties (bypass closed by absence)", () => {
    const css = renderCss(resolveTheme(base(), RAMPS));
    expect(css).not.toContain("--stapel-raw-");
    expect(css).not.toMatch(/--stapel-(gray|brand)-\d/);
  });

  it("is byte-stable across invocations", () => {
    const a = renderCss(resolveTheme(base(), RAMPS));
    const b = renderCss(resolveTheme(base(), RAMPS));
    expect(a).toBe(b);
  });

  it("tailwind@4 maps each role to a --color-* var referencing the stable core (no RGB)", () => {
    const tw = renderTailwind4(resolveTheme(base(), RAMPS));
    expect(tw).toContain("@theme {");
    expect(tw).toContain("--color-surface: var(--stapel-surface);");
    expect(tw).toContain("--color-brand: var(--stapel-brand);");
    expect(tw).not.toMatch(/-rgb/);
  });

  it("tailwind@3 emits RGB triplets alongside the stable core (legacy adapter, owned in-bin)", () => {
    const css = renderTailwind3Css(resolveTheme(base(), RAMPS));
    // brand.500 #4657d9 → 70 87 217
    expect(css).toContain("--stapel-brand-rgb: 70 87 217;");
    const config = renderTailwind3Config(resolveTheme(base(), RAMPS));
    expect(config).toContain('"brand": "rgb(var(--stapel-brand-rgb) / <alpha-value>)",');
  });
});

describe("validateTheme — contrast contract is a GATE (§68 Phase 6, 2026-07-18)", () => {
  it("errors (not just warns) on an intentionally-failing fg/bg pair — the build must fail", () => {
    // Deliberately low-contrast: a light-gray "text" on a near-white
    // "surface" — a real theme.json a host might author by mistake.
    const theme = base({
      core: {
        surface: { light: "gray.50", dark: "gray.900" },
        text: { light: "gray.50", dark: "brand.300" },
        brand: { light: "brand.500", dark: "brand.300" },
      },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(
      errors.some((e: string) => e.includes("contrast: text on surface (light)"))
    ).toBe(true);
  });

  it("does not error when the intentional pairs are legible", () => {
    const theme = base({
      core: {
        surface: { light: "gray.50", dark: "gray.900" },
        text: { light: "gray.900", dark: "gray.50" },
        brand: { light: "brand.500", dark: "brand.300" },
      },
    });
    const { errors, warnings } = validateTheme(theme, RAMPS);
    expect(errors.filter((e: string) => e.startsWith("contrast:"))).toEqual([]);
    expect(warnings.filter((w: string) => w.startsWith("contrast:"))).toEqual([]);
  });

  it("a documented contrastExceptions entry downgrades a real failure to a (non-fatal) warning", () => {
    const theme = base({
      core: {
        surface: { light: "gray.50", dark: "gray.900" },
        text: { light: "gray.50", dark: "brand.300" },
        brand: { light: "brand.500", dark: "brand.300" },
      },
      contrastExceptions: [
        {
          fg: "text",
          bg: "surface",
          mode: "light",
          reason: "test fixture — intentionally exempted for this spec",
        },
      ],
    });
    const { errors, warnings } = validateTheme(theme, RAMPS);
    expect(errors.filter((e: string) => e.startsWith("contrast:"))).toEqual([]);
    expect(
      warnings.some(
        (w: string) =>
          w.includes("contrast: text on surface (light)") &&
          w.includes("documented exception") &&
          w.includes("test fixture")
      )
    ).toBe(true);
  });

  it("errors if a contrastExceptions entry is missing a reason", () => {
    const theme = base({
      core: {
        surface: { light: "gray.50", dark: "gray.900" },
        text: { light: "gray.50", dark: "brand.300" },
        brand: { light: "brand.500", dark: "brand.300" },
      },
      contrastExceptions: [{ fg: "text", bg: "surface", mode: "light" }],
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors.some((e: string) => e.includes('requires a non-empty "reason" field'))).toBe(
      true
    );
  });

  it("errors on a stale exception whose pairing no longer fails (escape hatch must track live exceptions only)", () => {
    const theme = base({
      core: {
        surface: { light: "gray.50", dark: "gray.900" },
        text: { light: "gray.900", dark: "gray.50" }, // legible — no failure
        brand: { light: "brand.500", dark: "brand.300" },
      },
      contrastExceptions: [
        { fg: "text", bg: "surface", mode: "light", reason: "no longer applies" },
      ],
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors.some((e: string) => e.includes("the exception is stale"))).toBe(
      true
    );
  });
});

describe("mergeRamps", () => {
  it("merges host ramps over standard ramps and drops _comment", () => {
    const merged = mergeRamps(
      { gray: { "50": "#fff" }, _comment: "x" },
      { brand: { "500": "#4657d9" } },
    );
    expect(Object.keys(merged).sort()).toEqual(["brand", "gray"]);
  });
});

describe("mergeTheme — §68 merge-contract (host stapel.theme.json ⊃ theme.default.json)", () => {
  it("a host theme wins on the leaves it defines; everything else falls through", () => {
    const defaultTheme = base();
    const hostTheme = { core: { brand: { light: "brand.300", dark: "brand.500" } } };
    const merged = mergeTheme(defaultTheme, hostTheme);
    // host wins on `brand`…
    expect(merged.core.brand).toEqual({ light: "brand.300", dark: "brand.500" });
    // …but `surface` (untouched by the host) still falls through to default.
    expect(merged.core.surface).toEqual(defaultTheme.core.surface);
  });

  it("merges host ramps via mergeRamps, not a leaf overwrite", () => {
    const defaultTheme = { core: {}, ramps: { gray: { "50": "#fafafa" } } };
    const hostTheme = { ramps: { brand: { "500": "#4657d9" } } };
    const merged = mergeTheme(defaultTheme, hostTheme);
    expect(Object.keys(merged.ramps).sort()).toEqual(["brand", "gray"]);
  });

  it("an empty/absent host theme returns the default unchanged", () => {
    const defaultTheme = base();
    expect(mergeTheme(defaultTheme, {})).toBe(defaultTheme);
    expect(mergeTheme(defaultTheme, undefined)).toBe(defaultTheme);
  });
});

/**
 * `--scope <brand-key>` (multibrand spec, frontend decision): ONE build serving two brands.
 *
 * The storefront compiles `stapel.theme.json` (the default set, `:root`) and
 * `stapel.theme.northgate.json` (`--scope northgate`) into the SAME output
 * directory and ships both stylesheets in one bundle; which one applies is
 * decided at runtime by `<html data-brand>`, which `@stapel/core`'s
 * `<SiteProvider>` sets from the host's own `site/` document. Two things have
 * to hold for that: the scoped selectors must out-rank the unscoped ones, and
 * a scoped run must not overwrite the default run's files.
 */
describe("--scope — a brand overlay beside the default set", () => {
  it("scopes both halves under [data-brand], and the dark half keeps :root so it out-ranks the light one", () => {
    const css = renderCss(resolveTheme(base(), RAMPS), { scope: "northgate" });
    expect(css).toContain(':root[data-brand="northgate"] {');
    expect(css).toContain(':root[data-brand="northgate"][data-theme="dark"] {');
    // Not a single unqualified block: an unscoped `:root` emitted from a
    // brand's theme would repaint the OTHER brand's host.
    expect(css).not.toMatch(/^:root \{/m);
    expect(css).not.toMatch(/^\[data-theme="dark"\] \{/m);
    const dark = css.split(':root[data-brand="northgate"][data-theme="dark"]')[1] ?? "";
    expect(dark).toContain("--stapel-brand: #98a5fa;");
  });

  it("leaves the unscoped emission byte-identical (the default set is untouched)", () => {
    const resolved = resolveTheme(base(), RAMPS);
    expect(renderCss(resolved, {})).toBe(renderCss(resolved));
    expect(renderCss(resolved)).toContain(":root {");
    expect(renderTailwind3Css(resolved)).toContain(":root {");
  });

  it("scopes the tailwind@3 RGB block too — an unscoped triplet would override the other brand", () => {
    const css = renderTailwind3Css(resolveTheme(base(), RAMPS), { scope: "northgate" });
    expect(css).toContain(':root[data-brand="northgate"] {');
    expect(css).not.toMatch(/^:root \{/m);
  });

  it("refuses a key that is not [a-z0-9-]+ — it lands in a selector AND a filename", () => {
    const resolved = resolveTheme(base(), RAMPS);
    expect(() => renderCss(resolved, { scope: "Northgate Ru" })).toThrow(/\[a-z0-9-\]\+/);
    expect(() => renderCss(resolved, { scope: 'x"]{}' })).toThrow(/\[a-z0-9-\]\+/);
  });
});

describe("the stapel-tokens bin under --scope", () => {
  const binPath = resolve(here, "..", "bin/stapel-tokens.mjs");

  function run(args: string[], cwd: string): void {
    execFileSync(process.execPath, [binPath, ...args], { cwd, stdio: "pipe" });
  }

  it("writes a `.<key>`-infixed file that coexists with the default run, and --check reads it back", () => {
    const dir = mkdtempSync(join(tmpdir(), "stapel-tokens-scope-"));
    try {
      run(["--out", dir, "--targets", "core"], dir);
      run(["--out", dir, "--targets", "core", "--scope", "northgate"], dir);

      // Two runs, one directory, neither clobbering the other.
      expect(readdirSync(dir).sort()).toEqual(["tokens.css", "tokens.northgate.css"]);
      const scoped = readFileSync(join(dir, "tokens.northgate.css"), "utf8");
      expect(scoped).toContain(':root[data-brand="northgate"] {');
      expect(readFileSync(join(dir, "tokens.css"), "utf8")).toContain(":root {");

      // The drift gate works against the scoped output too…
      run(["--out", dir, "--targets", "core", "--scope", "northgate", "--check"], dir);
      // …and actually fails when the file on disk is stale.
      writeFileSync(join(dir, "tokens.northgate.css"), "/* hand-edited */\n");
      expect(() =>
        run(["--out", dir, "--targets", "core", "--scope", "northgate", "--check"], dir)
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000); // spawns the bin four times — slow under parallel full-CI load

  it("refuses --scope together with --pkg: the self artifacts describe the package, not a brand", () => {
    const dir = mkdtempSync(join(tmpdir(), "stapel-tokens-scope-"));
    try {
      expect(() =>
        run(
          ["--out", dir, "--scope", "northgate", "--pkg", resolve(here, "..", "package.json")],
          dir
        )
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
