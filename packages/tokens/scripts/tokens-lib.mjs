// Pure, side-effect-free token engine for @stapel/tokens (frontend-guardrails
// §1). The gen driver (gen-tokens.mjs) is a thin I/O wrapper around this; the
// package's tests import THESE functions directly to assert validator errors,
// so the three-tier invariants are unit-covered without shelling out.
//
// Three levels:
//   L1 ramps      raw hex, born here + in a host's `ramps` section, NEVER in CSS
//   L2 core       exactly {light,dark} pair of <ramp>.<step> refs (resolved to hex)
//   L3 component  exactly one core-token ref, emitted as a var() reference
//
// Everything is deterministic + byte-stable: keys are sorted, numbers
// canonicalised, no timestamps — same input, same bytes.

export const PREFIX = "--stapel";

// Core-token name grid (frontend-guardrails §1.1): recommendation, not a gate.
// A name outside the grid is a WARNING (custom host tokens are legal, §1.4).
const GRID_GROUPS = new Set([
  "background",
  "upperground",
  "text",
  "icon",
  "border",
]);
// Standalone semantic tokens that legitimately sit outside the group grid.
const GRID_STANDALONE = new Set([
  "accent",
  "accent-hover",
  "focus-ring",
  "overlay",
]);

const RAMP_STEP_RE = /^[a-z][a-z0-9]*\.[a-z0-9]+$/i;
const COLORish_RE = /#|rgba?\(|hsla?\(/i;

function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function sortedEntries(record) {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0));
}

function px(value) {
  return value === 0 ? "0" : `${String(value)}px`;
}

/** Merge a host theme's custom ramps on top of the built-in standard ramps. */
export function mergeRamps(standardRamps, themeRamps) {
  const merged = {};
  for (const [name, steps] of sortedEntries({ ...standardRamps, ...themeRamps })) {
    if (name.startsWith("_")) continue; // drop `_comment`
    merged[name] = { ...steps };
  }
  return merged;
}

/** Resolve a `<ramp>.<step>` reference to a raw hex/colour value. */
function resolveRef(ramps, ref) {
  const dot = ref.indexOf(".");
  const ramp = ref.slice(0, dot);
  const step = ref.slice(dot + 1);
  return ramps[ramp]?.[step];
}

/**
 * Validate the three-tier structure. Returns { errors, warnings } (arrays of
 * strings). A non-empty `errors` means the build must fail (gen driver exits
 * non-zero). Messages are teaching messages (frontend-guardrails §1.3) —
 * localised to match the spec's examples.
 */
export function validateTheme(theme, ramps) {
  const errors = [];
  const warnings = [];
  const core = theme.core ?? {};
  const component = theme.component ?? {};

  const rampStepList = (ramp) =>
    ramps[ramp] ? Object.keys(ramps[ramp]).join(", ") : "";

  // ── L2 core: each token is EXACTLY a {light,dark} pair of ramp refs ────────
  for (const [name, def] of sortedEntries(core)) {
    if (name.startsWith("_")) continue;
    for (const mode of ["light", "dark"]) {
      const ref = def?.[mode];
      if (ref === undefined || ref === null || ref === "") {
        errors.push(
          `tokens: core "${name}" — нет значения "${mode}" (core-токен = ` +
            `строго пара {light,dark})`
        );
        continue;
      }
      if (COLORish_RE.test(ref)) {
        errors.push(
          `tokens: core "${name}".${mode} → "${ref}" — сырые ссылки только ` +
            `вида <ramp>.<step>; hex в core-секции запрещён (добавь ступень в ` +
            `линейку)`
        );
        continue;
      }
      if (!RAMP_STEP_RE.test(ref)) {
        errors.push(
          `tokens: core "${name}".${mode} → "${ref}" — ожидалась ссылка вида ` +
            `<ramp>.<step>`
        );
        continue;
      }
      const dot = ref.indexOf(".");
      const ramp = ref.slice(0, dot);
      const step = ref.slice(dot + 1);
      if (!ramps[ramp]) {
        errors.push(
          `tokens: core "${name}".${mode} → "${ref}" — нет линейки "${ramp}"`
        );
        continue;
      }
      if (ramps[ramp][step] === undefined) {
        errors.push(
          `tokens: core "${name}".${mode} → "${ref}" — нет такой ступени в ` +
            `линейке "${ramp}" (есть: ${rampStepList(ramp)})`
        );
      }
    }
    // Grid conformance — warning only.
    const group = name.split("-")[0];
    if (!GRID_GROUPS.has(group) && !GRID_STANDALONE.has(name)) {
      warnings.push(
        `tokens: core "${name}" — имя вне конвенционной сетки ` +
          `(${[...GRID_GROUPS].join("/")} × роли × веса); допустимо, но проверь`
      );
    }
  }

  // ── L3 component: each token references EXACTLY one core token ─────────────
  const coreNames = new Set(
    Object.keys(core).filter((n) => !n.startsWith("_"))
  );
  for (const [name, ref] of sortedEntries(component)) {
    if (name.startsWith("_")) continue;
    if (typeof ref !== "string") {
      errors.push(
        `tokens: component "${name}" — значение должно быть одной ссылкой на ` +
          `core-токен (строка), получено ${typeof ref}`
      );
      continue;
    }
    const parts = ref.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 1) {
      errors.push(
        `tokens: component "${name}" → "${ref}" — ровно одна ссылка, ` +
          `получено ${parts.length}`
      );
      continue;
    }
    const single = parts[0];
    if (single.includes(".") || COLORish_RE.test(single)) {
      errors.push(
        `tokens: component "${name}" → "${single}" — компонентный токен ` +
          `ссылается ровно на 1 core-токен, не на линейку`
      );
      continue;
    }
    if (!coreNames.has(single)) {
      errors.push(
        `tokens: component "${name}" → "${single}" — нет такого core-токена`
      );
    }
  }

  return { errors, warnings };
}

/**
 * Resolve the theme into the shape the renderers consume. Throws (via the gen
 * driver) never — callers should run validateTheme first.
 */
export function resolveTheme(theme, ramps) {
  const core = {};
  for (const [name, def] of sortedEntries(theme.core ?? {})) {
    if (name.startsWith("_")) continue;
    core[name] = {
      light: resolveRef(ramps, def.light),
      dark: resolveRef(ramps, def.dark),
      lightRef: def.light,
      darkRef: def.dark,
    };
  }
  const component = {};
  for (const [name, ref] of sortedEntries(theme.component ?? {})) {
    if (name.startsWith("_")) continue;
    component[name] = ref;
  }
  const elevation = {};
  for (const [name, def] of sortedEntries(theme.elevation ?? {})) {
    if (name.startsWith("_")) continue;
    elevation[name] = { light: def.light, dark: def.dark };
  }
  const scales = theme.scales ?? {};
  return { core, component, elevation, scales };
}

/** Render tokens.css: L2 pairs (:root + [data-theme="dark"]), L3 var-refs, scales. */
export function renderCss(resolved) {
  const { core, component, elevation, scales } = resolved;
  const rootColor = [];
  const darkColor = [];
  const rootElev = [];
  const darkElev = [];
  const rootScale = [];
  const rootComponent = [];

  for (const [name, t] of sortedEntries(core)) {
    rootColor.push(`${PREFIX}-color-${name}: ${t.light}; /* ${t.lightRef} */`);
    darkColor.push(`${PREFIX}-color-${name}: ${t.dark}; /* ${t.darkRef} */`);
  }
  for (const [name, t] of sortedEntries(elevation)) {
    rootElev.push(`${PREFIX}-elevation-${name}: ${t.light};`);
    darkElev.push(`${PREFIX}-elevation-${name}: ${t.dark};`);
  }
  for (const [name, value] of sortedEntries(scales.fontFamily ?? {})) {
    rootScale.push(`${PREFIX}-font-family-${kebab(name)}: ${value};`);
  }
  for (const [name, step] of sortedEntries(scales.fontSize ?? {})) {
    rootScale.push(`${PREFIX}-font-size-${kebab(name)}: ${px(step.fontSize)};`);
    rootScale.push(`${PREFIX}-line-height-${kebab(name)}: ${px(step.lineHeight)};`);
  }
  for (const [name, value] of sortedEntries(scales.fontWeight ?? {})) {
    rootScale.push(`${PREFIX}-font-weight-${kebab(name)}: ${String(value)};`);
  }
  for (const [name, value] of sortedEntries(scales.spacing ?? {})) {
    rootScale.push(`${PREFIX}-space-${kebab(name)}: ${px(value)};`);
  }
  for (const [name, value] of sortedEntries(scales.radii ?? {})) {
    rootScale.push(`${PREFIX}-radius-${kebab(name)}: ${px(value)};`);
  }
  for (const [name, value] of sortedEntries(scales.breakpoints ?? {})) {
    rootScale.push(`${PREFIX}-breakpoint-${kebab(name)}: ${px(value)};`);
  }
  // L3 — one declaration each, theme-invariant (no dark block by construction).
  for (const [name, ref] of sortedEntries(component)) {
    rootComponent.push(`${PREFIX}-${name}: var(${PREFIX}-color-${ref});`);
  }

  const indent = (lines) => lines.map((l) => `  ${l}`).join("\n");

  return [
    "/* Generated by @stapel/tokens (pnpm gen:tokens) — do not edit.",
    "   Source: theme.default.json + ramps.standard.json. Drift gate: pnpm gen:tokens:check. */",
    ":root {",
    "  /* L2 core colours — light */",
    indent(rootColor),
    "",
    "  /* elevation — light */",
    indent(rootElev),
    "",
    "  /* scales (non-themed) */",
    indent(rootScale),
    "",
    "  /* L3 component tokens — theme-invariant var() references; theme flows through L2 */",
    indent(rootComponent),
    "}",
    "",
    '[data-theme="dark"] {',
    "  /* L2 core colours — dark */",
    indent(darkColor),
    "",
    "  /* elevation — dark */",
    indent(darkElev),
    "}",
    "",
  ].join("\n");
}

/**
 * Render the Tailwind v4 bridge (frontend-guardrails, user decision 2026-07-06):
 * `@theme` that maps a Tailwind colour per token to our CSS var, so vanilla
 * utilities like `bg-background-primary` / `text-text-primary` resolve to the
 * themed var. Static class names → JIT sees them; no interpolation needed.
 * Host: `@import "tailwindcss"; @import "@stapel/tokens/tailwind.css";`.
 */
export function renderTailwind(resolved) {
  const { core, component } = resolved;
  const lines = [];
  for (const [name] of sortedEntries(core)) {
    lines.push(`  --color-${name}: var(${PREFIX}-color-${name});`);
  }
  for (const [name] of sortedEntries(component)) {
    lines.push(`  --color-${name}: var(${PREFIX}-${name});`);
  }
  return [
    "/* Generated by @stapel/tokens (pnpm gen:tokens) — do not edit.",
    "   Tailwind v4 bridge: `@import \"tailwindcss\"; @import \"@stapel/tokens/tailwind.css\";`",
    "   Then use vanilla static utilities — bg-background-primary, text-text-primary,",
    "   border-border-primary, bg-button-primary-bg. NEVER arbitrary values with",
    "   interpolation (bg-[${x}]) — JIT cannot see them (frontend-guardrails §1.5). */",
    "@theme {",
    ...lines,
    "}",
    "",
  ].join("\n");
}

function tsUnion(names) {
  if (names.length === 0) return "never";
  return names.map((n) => JSON.stringify(n)).join("\n  | ");
}

/** Render the typed generated tokens.ts (unions + typed cssVar + back-compat colors). */
export function renderTokensTs(resolved) {
  const { core, component, elevation, scales } = resolved;
  const coreNames = Object.keys(core).sort();
  const componentNames = Object.keys(component).sort();

  // Back-compat resolved colours object (public API `colors`, §1.4).
  const colorsObj = {};
  for (const name of coreNames) {
    colorsObj[name] = { light: core[name].light, dark: core[name].dark };
  }

  const scaleVarNames = [];
  for (const n of Object.keys(scales.fontFamily ?? {})) scaleVarNames.push(`font-family-${kebab(n)}`);
  for (const n of Object.keys(scales.fontSize ?? {})) {
    scaleVarNames.push(`font-size-${kebab(n)}`);
    scaleVarNames.push(`line-height-${kebab(n)}`);
  }
  for (const n of Object.keys(scales.fontWeight ?? {})) scaleVarNames.push(`font-weight-${kebab(n)}`);
  for (const n of Object.keys(scales.spacing ?? {})) scaleVarNames.push(`space-${kebab(n)}`);
  for (const n of Object.keys(scales.radii ?? {})) scaleVarNames.push(`radius-${kebab(n)}`);
  for (const n of Object.keys(scales.breakpoints ?? {})) scaleVarNames.push(`breakpoint-${kebab(n)}`);
  for (const n of Object.keys(elevation)) scaleVarNames.push(`elevation-${kebab(n)}`);
  scaleVarNames.sort();

  const lit = (v) => JSON.stringify(v, null, 2);

  return `// AUTO-GENERATED by scripts/gen-tokens.mjs — do not edit by hand.
// Source: theme.default.json + ramps.standard.json.
// Regenerate: pnpm gen:tokens   ·   Drift gate: pnpm gen:tokens:check

/** Semantic (L2) core token names — a {light,dark} pair each. */
export type CoreTokenName =
  | ${tsUnion(coreNames)};

/** Component (L3) token names — one core-token reference each, theme-invariant. */
export type ComponentTokenName =
  | ${tsUnion(componentNames)};

export type TokenName = CoreTokenName | ComponentTokenName;

/**
 * Every legal CSS custom-property suffix under \`--stapel-*\`. \`cssVar\` accepts
 * only these, so a typo in a token name does not compile (frontend-guardrails §1.2).
 */
export type StapelVar =
  | \`color-\${CoreTokenName}\`
  | ComponentTokenName
  | ${tsUnion(scaleVarNames)};

/** \`cssVar("color-accent")\` → \`var(--stapel-color-accent)\`. Typed: unknown names fail to compile. */
export function cssVar(name: StapelVar): string {
  return \`var(--stapel-\${name})\`;
}

export interface ColorToken {
  readonly light: string;
  readonly dark: string;
}

/**
 * Resolved (hex) light/dark values per core token — the back-compat public
 * \`colors\` surface (§1.4). Prefer CSS vars / Tailwind utilities in components;
 * this object exists for tooling (showcase, contrast checks). Themes still
 * switch via \`data-theme\`, not by reading these strings at runtime.
 */
export const colors = ${lit(colorsObj)} as const;

export type ColorTokenName = keyof typeof colors;

/** L3 component token → the core token it references (theme-invariant). */
export const componentTokens = ${lit(component)} as const;

/** Elevation (box-shadow) levels — light/dark pairs like colours. */
export const elevation = ${lit(elevation)} as const;

export type ElevationToken = ColorToken;
export type ElevationName = keyof typeof elevation;

export const fontFamily = ${lit(scales.fontFamily ?? {})} as const;
export const fontSize = ${lit(scales.fontSize ?? {})} as const;
export const fontWeight = ${lit(scales.fontWeight ?? {})} as const;
export const spacing = ${lit(scales.spacing ?? {})} as const;
export const radii = ${lit(scales.radii ?? {})} as const;
export const breakpoints = ${lit(scales.breakpoints ?? {})} as const;

export interface TypeStep {
  readonly fontSize: number;
  readonly lineHeight: number;
}
export type FontSizeName = keyof typeof fontSize;
export type FontWeightName = keyof typeof fontWeight;
export type SpacingStep = keyof typeof spacing;
export type RadiusName = keyof typeof radii;
export type Breakpoint = keyof typeof breakpoints;
`;
}

/** Render the raw-ramp module for the `@stapel/tokens/raw` subpath. */
export function renderRawTs(ramps) {
  const lit = JSON.stringify(ramps, null, 2);
  return `// AUTO-GENERATED by scripts/gen-tokens.mjs — do not edit by hand.
// Source: ramps.standard.json + theme.default.json \`ramps\`.
// Regenerate: pnpm gen:tokens   ·   Drift gate: pnpm gen:tokens:check
//
// L1 raw ramps — the ONLY place hex lives. Reachable via \`@stapel/tokens/raw\`
// for theme-config + the design-system showcase ONLY (lint-guarded elsewhere,
// frontend-guardrails §2.2). These are NOT emitted as CSS custom properties:
// there is no \`--stapel-raw-*\` to reference (bypass closed by absence of API).

export const ramps = ${lit} as const;

export type RampName = keyof typeof ramps;
`;
}

/** Render the tokens package manifest (§6 — self-description, phase-1 pattern). */
export function renderManifest(pkg, resolved, ramps) {
  const { core, component, elevation, scales } = resolved;
  return {
    $generated:
      "by scripts/gen-tokens.mjs — do not edit; drift-gated (pnpm gen:tokens:check)",
    package: pkg.name,
    version: pkg.version,
    tokens: {
      core: Object.keys(core).sort(),
      component: Object.keys(component).sort(),
      elevation: Object.keys(elevation).sort(),
      scales: {
        fontFamily: Object.keys(scales.fontFamily ?? {}).sort(),
        fontSize: Object.keys(scales.fontSize ?? {}).sort(),
        fontWeight: Object.keys(scales.fontWeight ?? {}).sort(),
        spacing: Object.keys(scales.spacing ?? {}).sort(),
        radii: Object.keys(scales.radii ?? {}).sort(),
        breakpoints: Object.keys(scales.breakpoints ?? {}).sort(),
      },
    },
    ramps: {
      $note:
        "L1 raw ramps — hex source of truth; NOT a CSS API (no --stapel-raw-*). Reachable only via @stapel/tokens/raw.",
      names: Object.keys(ramps).sort(),
    },
    usage: {
      tailwind:
        "bg-background-primary / text-text-primary / border-border-primary / bg-button-primary-bg (static utilities; import @stapel/tokens/tailwind.css)",
      css: "var(--stapel-color-<core>) · var(--stapel-<component>)",
      ts: 'cssVar("color-accent")',
      forbidden: [
        "hex/rgb/hsl literals in component code (hex is born only in ramps)",
        "raw ramps in components (@stapel/tokens/raw is theme-config/showcase only)",
        "Tailwind arbitrary values with interpolation (bg-[${x}]) — JIT-invisible",
      ],
    },
  };
}

/** Render the tokens package llms.txt (§6 — canonical usage + explicit forbidden). */
export function renderLlms(pkg, resolved) {
  const { core, component, scales } = resolved;
  const L = [];
  L.push(`# ${pkg.name} ${pkg.version}`);
  L.push("");
  L.push(
    "Three-tier design tokens (frontend-guardrails §1). Generated from theme.default.json;"
  );
  L.push(
    "code is never hand-edited. Theme switches via a `data-theme` attribute on the root —"
  );
  L.push("never a JS re-render, never reading hex at runtime.");
  L.push("");
  L.push("## The one right way (do this; anything else is a lint/review smell)");
  L.push(
    "- Tailwind (canonical, static utilities — import `@stapel/tokens/tailwind.css`):"
  );
  L.push(
    "    <div class=\"bg-background-primary text-text-primary border-border-primary\">"
  );
  L.push('    <button class="bg-button-primary-bg text-button-primary-text">');
  L.push("- Plain CSS: `color: var(--stapel-color-text-primary)` ·");
  L.push("    `background: var(--stapel-button-primary-bg)`");
  L.push('- TS: `cssVar("color-accent")` → `var(--stapel-color-accent)` (typed; typos fail to compile)');
  L.push("");
  L.push("## Never (closed by construction and/or lint)");
  L.push("- hex/rgb/hsl literals in components — hex is born ONLY in ramps (theme.json).");
  L.push("- raw ramps (`gray.500`, `@stapel/tokens/raw`) in components — theme-config/showcase only;");
  L.push("  raw ramps are NOT CSS vars, there is no `--stapel-raw-*` to reference.");
  L.push("- Tailwind arbitrary values with interpolation (`bg-[${x}]`) — JIT cannot see them.");
  L.push("- theme-dependent component tokens — L3 is a var() ref; light/dark ends at L2.");
  L.push("");
  L.push("## Levels");
  L.push("L1 ramps (raw hex) → L2 core (semantic, {light,dark} pair) → L3 component (1 core ref).");
  L.push("A core token missing a pair, or a component token with ≠1 core ref, is a BUILD ERROR.");
  L.push("");
  L.push("## Core tokens (L2 — `--stapel-color-<name>`, Tailwind `*-<name>`)");
  L.push(Object.keys(core).sort().join(", "));
  L.push("");
  L.push("## Component tokens (L3 — `--stapel-<name>`, Tailwind `*-<name>`)");
  L.push(Object.keys(component).sort().join(", "));
  L.push("");
  L.push("## Non-colour scales (`--stapel-space-*`, `-radius-*`, `-font-size-*`, `-elevation-*`)");
  L.push(
    `spacing: ${Object.keys(scales.spacing ?? {}).join(", ")} · radii: ${Object.keys(scales.radii ?? {}).join(", ")}`
  );
  L.push(
    `fontSize: ${Object.keys(scales.fontSize ?? {}).join(", ")} · fontWeight: ${Object.keys(scales.fontWeight ?? {}).join(", ")}`
  );
  return L.join("\n") + "\n";
}
