import { describe, expect, it } from "vitest";
// The gen engine is plain ESM; the driver (scripts/gen-tokens.mjs) is a thin
// I/O wrapper around it, so the three-tier invariants are unit-covered here.
import {
  mergeRamps,
  validateTheme,
  resolveTheme,
  renderCss,
  renderTailwind,
  // @ts-expect-error — .mjs has no type declarations; it's a build/gen tool.
} from "../scripts/tokens-lib.mjs";

const RAMPS = {
  gray: { "50": "#fafafa", "500": "#7b828f", "900": "#111111" },
  brand: { "300": "#98a5fa", "500": "#4657d9" },
};

function base(overrides: Record<string, unknown> = {}) {
  return {
    core: {
      "background-primary": { light: "gray.50", dark: "gray.900" },
      accent: { light: "brand.500", dark: "brand.300" },
    },
    component: { "button-primary-bg": "accent" },
    ...overrides,
  };
}

describe("validateTheme — core-token invariants", () => {
  it("passes a well-formed theme", () => {
    const { errors } = validateTheme(base(), RAMPS);
    expect(errors).toEqual([]);
  });

  it("errors when a core token is missing its dark half (unpaired)", () => {
    const theme = base({
      core: { "background-primary": { light: "gray.50" } },
      component: {},
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('core "background-primary"');
    expect(errors[0]).toContain('нет значения "dark"');
  });

  it("errors when a core ref points at a non-existent ramp step", () => {
    const theme = base({
      core: { accent: { light: "brand.550", dark: "brand.300" } },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('accent".light → "brand.550"');
    expect(errors[0]).toContain("нет такой ступени в линейке");
    // teaching message lists the available steps
    expect(errors[0]).toContain("300, 500");
  });

  it("errors when a core ref is a raw hex (hex forbidden in core)", () => {
    const theme = base({
      core: { danger: { light: "#c93a3a", dark: "brand.300" } },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors.some((e: string) => e.includes("hex в core-секции запрещён"))).toBe(true);
  });

  it("warns (not errors) on a name outside the convention grid", () => {
    const theme = base({
      core: { "wat-token": { light: "gray.50", dark: "gray.900" } },
      component: {},
    });
    const { errors, warnings } = validateTheme(theme, RAMPS);
    expect(errors).toEqual([]);
    expect(warnings.some((w: string) => w.includes("вне конвенционной сетки"))).toBe(true);
  });
});

describe("validateTheme — component-token invariants", () => {
  it("errors when a component token references a ramp, not a core token", () => {
    const theme = base({ component: { "button-primary-bg": "blue.500" } });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ссылается ровно на 1 core-токен, не на линейку");
  });

  it("errors when a component token has two references", () => {
    const theme = base({
      component: { "card-glow": "accent, background-primary" },
    });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ровно одна ссылка, получено 2");
  });

  it("errors when a component token references an unknown core token", () => {
    const theme = base({ component: { "button-primary-bg": "nope" } });
    const { errors } = validateTheme(theme, RAMPS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("нет такого core-токена");
  });
});

describe("resolve + render", () => {
  it("inlines resolved hex for L2 and emits L3 as theme-invariant var() refs", () => {
    const resolved = resolveTheme(base(), RAMPS);
    const css = renderCss(resolved);
    // L2: raw hex inlined in :root + dark block
    expect(css).toContain("--stapel-color-accent: #4657d9;");
    expect(css).toContain("--stapel-color-accent: #98a5fa;");
    // L3: var() ref, and it lives ONLY in :root (no dark duplication)
    expect(css).toContain("--stapel-button-primary-bg: var(--stapel-color-accent);");
    const dark = css.split('[data-theme="dark"]')[1] ?? "";
    expect(dark).not.toContain("button-primary-bg");
  });

  it("never emits raw ramps as CSS custom properties (bypass closed by absence)", () => {
    const css = renderCss(resolveTheme(base(), RAMPS));
    expect(css).not.toContain("--stapel-raw-");
    expect(css).not.toMatch(/--stapel-(gray|brand)-/);
  });

  it("is byte-stable across invocations", () => {
    const a = renderCss(resolveTheme(base(), RAMPS));
    const b = renderCss(resolveTheme(base(), RAMPS));
    expect(a).toBe(b);
  });

  it("Tailwind bridge maps each token to a --color-* var (static utility source)", () => {
    const tw = renderTailwind(resolveTheme(base(), RAMPS));
    expect(tw).toContain("@theme {");
    expect(tw).toContain("--color-background-primary: var(--stapel-color-background-primary);");
    expect(tw).toContain("--color-button-primary-bg: var(--stapel-button-primary-bg);");
  });
});

describe("validateTheme — contrast contract (warning only, user decision Q10a)", () => {
  it("warns (not errors) on an intentionally-failing fg/bg pair, and still passes", () => {
    // Deliberately low-contrast: a light-gray "text-primary" on a near-white
    // "background-primary" — a real theme.json a host might author by mistake.
    const theme = base({
      core: {
        "background-primary": { light: "gray.50", dark: "gray.900" },
        "text-primary": { light: "gray.50", dark: "brand.300" },
        accent: { light: "brand.500", dark: "brand.300" },
      },
    });
    const { errors, warnings } = validateTheme(theme, RAMPS);
    // Structurally valid theme (paired, valid refs) ⇒ no errors ⇒ gen:tokens
    // still exits 0 — a contrast failure alone must never fail the build.
    expect(errors).toEqual([]);
    expect(
      warnings.some((w: string) =>
        w.includes("contrast: text-primary на background-primary (light)")
      )
    ).toBe(true);
  });

  it("does not warn when the intentional pairs are legible", () => {
    const theme = base({
      core: {
        "background-primary": { light: "gray.50", dark: "gray.900" },
        "text-primary": { light: "gray.900", dark: "gray.50" },
        accent: { light: "brand.500", dark: "brand.300" },
      },
    });
    const { warnings } = validateTheme(theme, RAMPS);
    expect(warnings.filter((w: string) => w.startsWith("contrast:"))).toEqual([]);
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
