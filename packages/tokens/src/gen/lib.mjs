// Pure, side-effect-free token engine for @stapel/tokens (§68 — neutral
// colour-role dictionary; frontend-guardrails §1). The `stapel-tokens` bin
// (../../bin/stapel-tokens.mjs) is a thin CLI wrapper around this; the
// package's own tests import THESE functions directly to assert validator
// errors, so the dictionary invariants are unit-covered without shelling out.
//
// Lives under `src/gen/` — inside the PUBLISHED package (§68 Ф1 gate: "a host
// does not need to vendor/fork the generator"). A host installs
// `@stapel/tokens`, runs the `stapel-tokens` bin over its own
// `stapel.theme.json`, and gets the same artifacts this repo commits for its
// own default theme.
//
// ONE LEVEL of colour token: a "role" (§68 dictionary — surface/text/border/
// brand/link families + success/warning/error/info types). Each role is
// EXACTLY a {light,dark} pair of `<ramp>.<step>` refs, resolved to hex and
// emitted as `--stapel-<role>`. There is no component (L3) indirection —
// design-system bridges (tokens-antd, tokens-mui) translate roles straight
// into their own theme fields, and Tailwind's `@theme` aliases a Tailwind
// colour per role to the same CSS var. Hex is born ONLY in `ramps` (L1),
// never in `core`.
//
// VERSIONING (§68 "Версионирование эмиттеров"): the stable core (`renderCss`)
// is emitted unconditionally — a version-independent CSS substrate. Tailwind
// gets two addressable, coexisting adapters on top of it: `tailwind@4`
// (default; `@theme`, no RGB) and `tailwind@3` (legacy; RGB triplets + a JS
// config snippet for `rgb(var(..)/<alpha>)`). A future `tailwind@5` is one
// more adapter, additive — never a rewrite of the core.
//
// Everything is deterministic + byte-stable: keys are sorted, numbers
// canonicalised, no timestamps — same input, same bytes.

import { checkContrastPairs, contrastExceptionKey, hexToRgb } from "./contrast.mjs";

export const PREFIX = "--stapel";

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

/**
 * Deep-merge a host `stapel.theme.json` OVER `theme.default.json` (§68 Ф1
 * merge-contract): the host wins on every LEAF it defines; anything it
 * doesn't touch falls through to the default. Ramps are merged via
 * {@link mergeRamps} (same rule — host ramp names/steps win); every other
 * top-level section (`core`, `scales`, `elevation`) merges key-by-key,
 * recursing into plain objects and replacing (not concatenating) arrays and
 * scalars. `_comment` keys are carried through untouched (dropped later by
 * `mergeRamps`/render, never by this function).
 */
export function mergeTheme(defaultTheme, hostTheme) {
  if (!hostTheme || Object.keys(hostTheme).length === 0) return defaultTheme;
  const out = { ...defaultTheme };
  for (const [key, value] of Object.entries(hostTheme)) {
    if (key === "ramps") {
      out.ramps = mergeRamps(defaultTheme.ramps ?? {}, value ?? {});
      continue;
    }
    const base = defaultTheme[key];
    out[key] = deepMergeLeaves(base, value);
  }
  return out;
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMergeLeaves(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = deepMergeLeaves(base[k], v);
  }
  return out;
}

/** Resolve a `<ramp>.<step>` reference to a raw hex/colour value. */
function resolveRef(ramps, ref) {
  if (typeof ref !== "string") return undefined;
  const dot = ref.indexOf(".");
  if (dot === -1) return undefined;
  const ramp = ref.slice(0, dot);
  const step = ref.slice(dot + 1);
  return ramps[ramp]?.[step];
}

/**
 * Validate the role dictionary. Returns { errors, warnings } (arrays of
 * strings). A non-empty `errors` means the build must fail (bin exits
 * non-zero). Messages are teaching messages — localised to match the spec's
 * examples.
 */
export function validateTheme(theme, ramps) {
  const errors = [];
  const warnings = [];
  const core = theme.core ?? {};

  const rampStepList = (ramp) =>
    ramps[ramp] ? Object.keys(ramps[ramp]).join(", ") : "";

  // ── every role is EXACTLY a {light,dark} pair of ramp refs ────────────────
  for (const [name, def] of sortedEntries(core)) {
    if (name.startsWith("_")) continue;
    for (const mode of ["light", "dark"]) {
      const ref = def?.[mode];
      if (ref === undefined || ref === null || ref === "") {
        errors.push(
          `tokens: role "${name}" — нет значения "${mode}" (роль = строго ` +
            `пара {light,dark})`
        );
        continue;
      }
      if (COLORish_RE.test(ref)) {
        errors.push(
          `tokens: role "${name}".${mode} → "${ref}" — сырые ссылки только ` +
            `вида <ramp>.<step>; hex в core-секции запрещён (добавь ступень в ` +
            `линейку)`
        );
        continue;
      }
      if (!RAMP_STEP_RE.test(ref)) {
        errors.push(
          `tokens: role "${name}".${mode} → "${ref}" — ожидалась ссылка вида ` +
            `<ramp>.<step>`
        );
        continue;
      }
      const dot = ref.indexOf(".");
      const ramp = ref.slice(0, dot);
      const step = ref.slice(dot + 1);
      if (!ramps[ramp]) {
        errors.push(
          `tokens: role "${name}".${mode} → "${ref}" — нет линейки "${ramp}"`
        );
        continue;
      }
      if (ramps[ramp][step] === undefined) {
        errors.push(
          `tokens: role "${name}".${mode} → "${ref}" — нет такой ступени в ` +
            `линейке "${ramp}" (есть: ${rampStepList(ramp)})`
        );
      }
    }
  }

  // ── Contrast contract — a real GATE (§68 Ф6, 2026-07-18; supersedes the
  // v1 "warning only" of user decision Q10a now that the palettes have
  // stabilised): a failing pair is a build ERROR, unless the theme carries a
  // documented exception for that exact pairing in `contrastExceptions`.
  // Resolved independently of the structural errors above — a pair with an
  // invalid ref just resolves to undefined and is skipped by
  // checkContrastPairs, so a structural error is never double-reported as a
  // contrast failure.
  const resolvedForContrast = {};
  for (const [name, def] of sortedEntries(core)) {
    if (name.startsWith("_")) continue;
    resolvedForContrast[name] = {
      light: resolveRef(ramps, def?.light),
      dark: resolveRef(ramps, def?.dark),
    };
  }

  // `contrastExceptions`: an explicit, per-pairing escape hatch (documented
  // author override — frontend-guardrails "the gate must not be a
  // straitjacket for a genuinely-intentional exception"). Each entry is
  // `{ fg, bg, mode, reason }` — `reason` is REQUIRED and non-empty, so an
  // exception can never be silent; it shows up verbatim in the (still
  // surfaced, non-fatal) warning. An exception that doesn't match any actual
  // failure, or is missing its reason, is itself a validation error — it
  // must not be possible to accumulate dead/unreasoned entries.
  const exceptions = Array.isArray(theme.contrastExceptions) ? theme.contrastExceptions : [];
  const exceptionByKey = new Map();
  for (const exc of exceptions) {
    const { fg, bg, mode } = exc ?? {};
    if (!fg || !bg || !mode) {
      errors.push(
        `tokens: contrastExceptions entry ${JSON.stringify(exc)} — нужны поля ` +
          `"fg", "bg", "mode"`
      );
      continue;
    }
    if (typeof exc.reason !== "string" || exc.reason.trim() === "") {
      errors.push(
        `tokens: contrastExceptions "${fg}:${bg}:${mode}" — нужно непустое поле ` +
          `"reason" (документированное исключение, не молчаливое)`
      );
      continue;
    }
    exceptionByKey.set(contrastExceptionKey(fg, bg, mode), exc.reason);
  }

  const contrastFailures = checkContrastPairs(resolvedForContrast);
  const usedExceptionKeys = new Set();
  for (const failure of contrastFailures) {
    const reason = exceptionByKey.get(failure.key);
    if (reason !== undefined) {
      usedExceptionKeys.add(failure.key);
      warnings.push(`${failure.message} — задокументированное исключение: ${reason}`);
    } else {
      errors.push(failure.message);
    }
  }
  // A stale exception (nothing currently fails that pairing) is a validation
  // error too — the escape hatch must track real, live exceptions only.
  for (const [key, reason] of exceptionByKey) {
    if (!usedExceptionKeys.has(key)) {
      errors.push(
        `tokens: contrastExceptions "${key}" (reason: "${reason}") — эта пара ` +
          `сейчас проходит контраст, исключение больше не нужно (удали)`
      );
    }
  }

  return { errors, warnings };
}

/**
 * Resolve the theme into the shape the renderers consume. Throws (via the
 * bin) never — callers should run validateTheme first.
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
  const elevation = {};
  for (const [name, def] of sortedEntries(theme.elevation ?? {})) {
    if (name.startsWith("_")) continue;
    elevation[name] = { light: def.light, dark: def.dark };
  }
  const scales = theme.scales ?? {};
  return { core, elevation, scales };
}

function scaleLines(scales) {
  const lines = [];
  for (const [name, value] of sortedEntries(scales.fontFamily ?? {})) {
    lines.push(`${PREFIX}-font-family-${kebab(name)}: ${value};`);
  }
  for (const [name, step] of sortedEntries(scales.fontSize ?? {})) {
    lines.push(`${PREFIX}-font-size-${kebab(name)}: ${px(step.fontSize)};`);
    lines.push(`${PREFIX}-line-height-${kebab(name)}: ${px(step.lineHeight)};`);
  }
  for (const [name, value] of sortedEntries(scales.fontWeight ?? {})) {
    lines.push(`${PREFIX}-font-weight-${kebab(name)}: ${String(value)};`);
  }
  for (const [name, value] of sortedEntries(scales.spacing ?? {})) {
    lines.push(`${PREFIX}-space-${kebab(name)}: ${px(value)};`);
  }
  for (const [name, value] of sortedEntries(scales.radii ?? {})) {
    lines.push(`${PREFIX}-radius-${kebab(name)}: ${px(value)};`);
  }
  for (const [name, value] of sortedEntries(scales.breakpoints ?? {})) {
    lines.push(`${PREFIX}-breakpoint-${kebab(name)}: ${px(value)};`);
  }
  return lines;
}

/**
 * Render the STABLE CORE (§68 "Версионирование эмиттеров"): plain
 * `--stapel-<role>` CSS custom properties (:root = light, [data-theme="dark"]
 * = dark) plus elevation + the non-colour scales. Version-independent —
 * works in any browser, any Tailwind version (or none at all) forever. This
 * is the ONE file every consumer (antd bridge, mui bridge, Tailwind adapters,
 * plain CSS) ultimately reads at runtime.
 */
export function renderCss(resolved) {
  const { core, elevation, scales } = resolved;
  const rootColor = [];
  const darkColor = [];
  const rootElev = [];
  const darkElev = [];

  for (const [name, t] of sortedEntries(core)) {
    rootColor.push(`${PREFIX}-${name}: ${t.light}; /* ${t.lightRef} */`);
    darkColor.push(`${PREFIX}-${name}: ${t.dark}; /* ${t.darkRef} */`);
  }
  for (const [name, t] of sortedEntries(elevation)) {
    rootElev.push(`${PREFIX}-elevation-${name}: ${t.light};`);
    darkElev.push(`${PREFIX}-elevation-${name}: ${t.dark};`);
  }
  const rootScale = scaleLines(scales);

  const indent = (lines) => lines.map((l) => `  ${l}`).join("\n");

  return [
    "/* Generated by @stapel/tokens (`stapel-tokens` bin / pnpm gen:tokens) —",
    "   do not edit. Source: theme.default.json (or a host's stapel.theme.json)",
    "   + ramps.standard.json. Drift gate: pnpm gen:tokens:check.",
    "   STABLE CORE (§68): version-independent substrate — every design-system",
    "   bridge and every Tailwind adapter reads these vars, never regenerated",
    "   differently per Tailwind version. */",
    ":root {",
    "  /* roles — light */",
    indent(rootColor),
    "",
    "  /* elevation — light */",
    indent(rootElev),
    "",
    "  /* scales (non-themed) */",
    indent(rootScale),
    "}",
    "",
    '[data-theme="dark"] {',
    "  /* roles — dark */",
    indent(darkColor),
    "",
    "  /* elevation — dark */",
    indent(darkElev),
    "}",
    "",
  ].join("\n");
}

/**
 * Render the `tailwind@4` adapter (default; frontend-guardrails, user
 * decision 2026-07-06 + §68): an `@theme` block that maps a Tailwind colour
 * per ROLE to our CSS var, so vanilla utilities like `bg-brand` /
 * `text-text-muted` / `bg-success-bg` resolve to the themed var. Static class
 * names → JIT sees them; no interpolation needed. No RGB triplets — v4's
 * alpha utilities (`bg-brand/50`) go through native `color-mix`, so there is
 * nothing to duplicate. Host: `@import "tailwindcss"; @import
 * "@stapel/tokens/tailwind.css";`.
 */
export function renderTailwind4(resolved) {
  const { core } = resolved;
  const lines = [];
  for (const [name] of sortedEntries(core)) {
    lines.push(`  --color-${name}: var(${PREFIX}-${name});`);
  }
  return [
    "/* Generated by @stapel/tokens (`stapel-tokens` bin) — do not edit.",
    '   Tailwind v4 adapter ("tailwind@4", default): `@import "tailwindcss";',
    '   @import "@stapel/tokens/tailwind.css";` Then use vanilla static',
    "   utilities — bg-brand, text-text-muted, border-border-subtle,",
    "   bg-success-bg. Alpha via native color-mix (bg-brand/50) — NEVER",
    "   arbitrary values with interpolation (bg-[${x}]) — JIT cannot see them",
    "   (frontend-guardrails §1.5). No RGB triplets: v4 doesn't need them. */",
    "@theme {",
    ...lines,
    "}",
    "",
  ].join("\n");
}

/**
 * Render the `tailwind@3` adapter (legacy, §68 "Версионирование эмиттеров" —
 * kept as an OWNED adapter in the central bin, never a host fork). Tailwind
 * v3's JIT can't alpha-blend a `var()` colour directly, so v3 configs
 * conventionally split each colour into an RGB triplet CSS var and reference
 * it as `rgb(var(--x-rgb) / <alpha-value>)` from `tailwind.config.js`. This
 * emits ONLY the triplet vars — {@link renderTailwind3Config} emits the
 * matching JS config snippet. Non-hex role values (e.g. a custom host role
 * resolved to an rgba()) are skipped, not fatal — v3's RGB trick only ever
 * applied to solid colours anyway.
 */
export function renderTailwind3Css(resolved) {
  const { core } = resolved;
  const rootLines = [];
  const darkLines = [];
  for (const [name, t] of sortedEntries(core)) {
    const light = hexToRgb(t.light);
    const dark = hexToRgb(t.dark);
    if (light) rootLines.push(`${PREFIX}-${name}-rgb: ${light.join(" ")};`);
    if (dark) darkLines.push(`${PREFIX}-${name}-rgb: ${dark.join(" ")};`);
  }
  const indent = (lines) => lines.map((l) => `  ${l}`).join("\n");
  return [
    "/* Generated by @stapel/tokens (`stapel-tokens` bin) — do not edit.",
    '   Tailwind v3 adapter ("tailwind@3", legacy — kept for projects still on',
    "   Tailwind 3; v4 needs none of this). RGB triplets alongside the stable",
    "   core so tailwind.config.js can alpha-blend: rgb(var(--stapel-<role>-rgb)",
    "   / <alpha-value>). Pair with the config snippet from",
    "   renderTailwind3Config / tailwind@3.config.cjs. */",
    ":root {",
    indent(rootLines),
    "}",
    "",
    '[data-theme="dark"] {',
    indent(darkLines),
    "}",
    "",
  ].join("\n");
}

/**
 * Render the `tailwind@3` JS config snippet: a `theme.extend.colors` object
 * using the `rgb(var(..)/<alpha-value>)` pattern, one entry per role, to
 * `module.exports.merge` (or spread) into a host's `tailwind.config.js`.
 * CommonJS (`.cjs`) because Tailwind v3 configs are conventionally CJS.
 */
export function renderTailwind3Config(resolved) {
  const { core } = resolved;
  const lines = [];
  for (const [name] of sortedEntries(core)) {
    lines.push(
      `    "${name}": "rgb(var(${PREFIX}-${name}-rgb) / <alpha-value>)",`
    );
  }
  return [
    "// Generated by @stapel/tokens (`stapel-tokens` bin) — do not edit.",
    '// Tailwind v3 adapter ("tailwind@3", legacy): spread `colors` into your',
    "// tailwind.config.js's theme.extend.colors. Requires tailwind@3.css",
    "// (the RGB-triplet vars this config's rgb(var(..)/<alpha>) reads).",
    "module.exports = {",
    "  colors: {",
    ...lines,
    "  },",
    "};",
    "",
  ].join("\n");
}

function tsUnion(names) {
  if (names.length === 0) return "never";
  return names.map((n) => JSON.stringify(n)).join("\n  | ");
}

/** Render the typed generated tokens.ts (role union + typed cssVar + colors). */
export function renderTokensTs(resolved) {
  const { core, elevation, scales } = resolved;
  const coreNames = Object.keys(core).sort();

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

  return `// AUTO-GENERATED by @stapel/tokens' \`stapel-tokens\` bin — do not edit by hand.
// Source: theme.default.json + ramps.standard.json.
// Regenerate: pnpm gen:tokens   ·   Drift gate: pnpm gen:tokens:check

/** Neutral colour-ROLE names (§68 dictionary) — a {light,dark} pair each. */
export type CoreTokenName =
  | ${tsUnion(coreNames)};

export type TokenName = CoreTokenName;

/**
 * Every legal CSS custom-property suffix under \`--stapel-*\`. \`cssVar\` accepts
 * only these, so a typo in a role name does not compile (frontend-guardrails §1.2).
 */
export type StapelVar =
  | CoreTokenName
  | ${tsUnion(scaleVarNames)};

/** \`cssVar("brand")\` → \`var(--stapel-brand)\`. Typed: unknown names fail to compile. */
export function cssVar(name: StapelVar): string {
  return \`var(${PREFIX}-\${name})\`;
}

export interface ColorToken {
  readonly light: string;
  readonly dark: string;
}

/**
 * Resolved (hex) light/dark values per role — the back-compat public
 * \`colors\` surface (§1.4). Prefer CSS vars / Tailwind utilities in components;
 * this object exists for tooling (showcase, contrast checks, design-system
 * bridges). Themes still switch via \`data-theme\`, not by reading these
 * strings at runtime.
 */
export const colors = ${lit(colorsObj)} as const;

export type ColorTokenName = keyof typeof colors;

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
  return `// AUTO-GENERATED by @stapel/tokens' \`stapel-tokens\` bin — do not edit by hand.
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
  const { core, elevation, scales } = resolved;
  return {
    $generated:
      "by @stapel/tokens' `stapel-tokens` bin — do not edit; drift-gated (pnpm gen:tokens:check)",
    package: pkg.name,
    version: pkg.version,
    tokens: {
      core: Object.keys(core).sort(),
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
      tailwind4:
        "bg-brand / text-text-muted / border-border-subtle / bg-success-bg (static utilities; import @stapel/tokens/tailwind.css) — default adapter",
      tailwind3:
        "legacy adapter: @stapel/tokens/tailwind-v3.css (RGB triplets) + @stapel/tokens/tailwind-v3.config.cjs (rgb(var(..)/<alpha>) colors)",
      css: "var(--stapel-<role>)",
      ts: 'cssVar("brand")',
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
  const { core, scales } = resolved;
  const L = [];
  L.push(`# ${pkg.name} ${pkg.version}`);
  L.push("");
  L.push(
    "Neutral colour-role dictionary (§68; frontend-guardrails §1). Generated from"
  );
  L.push(
    "theme.default.json (or a host's stapel.theme.json); code is never hand-edited."
  );
  L.push(
    "Theme switches via a `data-theme` attribute on the root — never a JS re-render,"
  );
  L.push("never reading hex at runtime.");
  L.push("");
  L.push("## The one right way (do this; anything else is a lint/review smell)");
  L.push(
    "- Tailwind v4 (default adapter, static utilities — import `@stapel/tokens/tailwind.css`):"
  );
  L.push(
    "    <div class=\"bg-surface text-text border-border rounded p-4\">"
  );
  L.push('    <button class="bg-brand text-text-on-accent">Buy</button>');
  L.push("- Plain CSS: `color: var(--stapel-text)` · `background: var(--stapel-brand)`");
  L.push('- TS: `cssVar("brand")` → `var(--stapel-brand)` (typed; typos fail to compile)');
  L.push(
    "- Tailwind v3 (legacy): import `@stapel/tokens/tailwind-v3.css` + spread"
  );
  L.push(
    "  `@stapel/tokens/tailwind-v3.config.cjs` into `theme.extend.colors`."
  );
  L.push("");
  L.push("## Never (closed by construction and/or lint)");
  L.push("- hex/rgb/hsl literals in components — hex is born ONLY in ramps (theme.json).");
  L.push("- raw ramps (`gray.500`, `@stapel/tokens/raw`) in components — theme-config/showcase only;");
  L.push("  raw ramps are NOT CSS vars, there is no `--stapel-raw-*` to reference.");
  L.push("- Tailwind arbitrary values with interpolation (`bg-[${x}]`) — JIT cannot see them.");
  L.push("");
  L.push("## Levels");
  L.push("L1 ramps (raw hex) → role (semantic, {light,dark} pair, `--stapel-<role>`).");
  L.push("A role missing a pair is a BUILD ERROR.");
  L.push("");
  L.push("## Roles (`--stapel-<role>`, Tailwind `*-<role>`)");
  L.push(Object.keys(core).sort().join(", "));
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
