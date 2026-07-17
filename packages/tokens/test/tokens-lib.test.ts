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
    expect(errors[0]).toContain('нет значения "dark"');
  });

  it("errors when a role ref points at a non-existent ramp step", () => {
    const theme = base({
      core: { brand: { light: "brand.550", dark: "brand.300" } },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('brand".light → "brand.550"');
    expect(errors[0]).toContain("нет такой ступени в линейке");
    // teaching message lists the available steps
    expect(errors[0]).toContain("300, 500");
  });

  it("errors when a role ref is a raw hex (hex forbidden in core)", () => {
    const theme = base({
      core: { error: { light: "#c93a3a", dark: "brand.300" } },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors.some((e: string) => e.includes("hex в core-секции запрещён"))).toBe(true);
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

describe("validateTheme — contrast contract is a GATE (§68 Ф6, 2026-07-18)", () => {
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
      errors.some((e: string) => e.includes("contrast: text на surface (light)"))
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
          w.includes("contrast: text на surface (light)") &&
          w.includes("задокументированное исключение") &&
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
    expect(errors.some((e: string) => e.includes('нужно непустое поле "reason"'))).toBe(
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
    expect(errors.some((e: string) => e.includes("исключение больше не нужно"))).toBe(
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
