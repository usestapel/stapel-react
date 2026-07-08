// WCAG contrast checker for @stapel/tokens (frontend-guardrails §1, user
// decision Q10a — 2026-07-08): a WARNING, not a build gate. v1 ships with
// contrast surfaced as diagnostic output only, tightened to an error once the
// palettes (ramps.standard.json + host themes) stabilise.
//
// Pure, side-effect-free — same contract as tokens-lib.mjs: no I/O, no
// randomness, so it is directly unit-testable and safely importable by the
// validator.

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parse a hex colour ("#fff" or "#ffffff") into an [r,g,b] triple (0-255).
 * Returns null for anything that isn't a plain hex literal (e.g. the `scrim`
 * ramp's rgba() values) — those are skipped by contrastRatio, not warned on.
 */
export function hexToRgb(hex) {
  if (typeof hex !== "string" || !HEX_RE.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function srgbChannel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0..1) of an [r,g,b] triple (0-255 each). */
export function relativeLuminance([r, g, b]) {
  const R = srgbChannel(r);
  const G = srgbChannel(g);
  const B = srgbChannel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * WCAG contrast ratio (1..21) between two hex colours. Returns null if either
 * side isn't a parseable hex literal — callers should treat null as "not
 * applicable", not as a failure.
 */
export function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return null;
  const lA = relativeLuminance(a);
  const lB = relativeLuminance(b);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Explicit contrast contract (user decision Q10a): the "intentional" fg/bg
 * pairs implied by the L2 naming grid (background/upperground/text/icon/border
 * × role, frontend-guardrails §1.1) that must stay legible. This is a curated
 * list, NOT the full cross product of every core token against every other —
 * most core tokens never actually sit on top of each other in the UI, so a
 * blind cross product would just be noise. Extend deliberately when a new
 * fg-on-bg relationship becomes real.
 *
 * Each entry: [fg core-token name, bg core-token name, "text" | "ui"].
 *   "text" → WCAG AA normal text, 4.5:1.
 *   "ui"   → large text / icon / border / focus ring, 3:1 (WCAG 1.4.11
 *            non-text contrast + 1.4.3 large-text exception).
 */
export const CONTRAST_PAIRS = [
  // text on the surfaces it actually renders over
  ["text-primary", "background-primary", "text"],
  ["text-primary", "background-secondary", "text"],
  ["text-primary", "upperground-primary", "text"],
  ["text-secondary", "background-primary", "text"],
  ["text-secondary", "background-secondary", "text"],
  ["text-secondary", "upperground-primary", "text"],
  ["text-brand", "background-primary", "text"],
  ["text-positive", "background-positive-subtle", "text"],
  ["text-negative", "background-negative-subtle", "text"],
  ["text-warning", "background-warning-subtle", "text"],
  ["text-info", "background-info-subtle", "text"],
  ["text-on-accent", "accent", "text"],
  // icon/border/focus — UI (non-text) contrast, 3:1
  ["icon-primary", "background-primary", "ui"],
  ["icon-secondary", "background-primary", "ui"],
  ["icon-brand", "background-primary", "ui"],
  ["border-primary", "background-primary", "ui"],
  ["border-secondary", "background-secondary", "ui"],
  ["border-brand", "background-primary", "ui"],
  ["focus-ring", "background-primary", "ui"],
];

const THRESHOLD = { text: 4.5, ui: 3.0 };

/**
 * Check CONTRAST_PAIRS against a theme's resolved core tokens, in BOTH light
 * and dark. `resolvedCore` is `{ [coreTokenName]: { light: hex, dark: hex } }`
 * — the shape `resolveTheme(...).core` already produces (minus the `*Ref`
 * fields, which are ignored here).
 *
 * A pair whose fg or bg token doesn't exist in this theme is silently
 * skipped — custom/host themes aren't required to define the full default
 * grid (frontend-guardrails §1.4). Same for a non-hex resolved value (e.g. a
 * `scrim` rgba) — contrastRatio returns null and it's skipped, not warned.
 *
 * Returns an array of warning strings (no `⚠` prefix — the caller/driver adds
 * that, same convention as the grid-conformance warnings in validateTheme).
 */
export function checkContrastPairs(resolvedCore) {
  const warnings = [];
  for (const [fgName, bgName, kind] of CONTRAST_PAIRS) {
    const fg = resolvedCore[fgName];
    const bg = resolvedCore[bgName];
    if (!fg || !bg) continue;
    const threshold = THRESHOLD[kind];
    for (const mode of ["light", "dark"]) {
      const ratio = contrastRatio(fg[mode], bg[mode]);
      if (ratio === null) continue;
      if (ratio < threshold) {
        warnings.push(
          `contrast: ${fgName} на ${bgName} (${mode}) = ${ratio.toFixed(1)}:1 < ${threshold} (WCAG AA)`
        );
      }
    }
  }
  return warnings;
}
