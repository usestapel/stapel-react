// WCAG contrast checker for @stapel/tokens (§68 neutral role dictionary,
// frontend-guardrails §1). GATE, not a warning (2026-07-18 — the palettes
// have stabilised per user decision Q10a's own plan): a failing pair is a
// build ERROR (bin exits non-zero, `--check` fails) unless the theme
// author has explicitly documented an exception (see `contrastExceptions`
// in lib.mjs's `validateTheme`) — the escape hatch exists so the gate isn't
// a straitjacket for a genuinely-intentional low-contrast pairing, but
// silence is never an option: every failing pair either gets fixed or gets
// a named, reasoned exception on record.
//
// Pure, side-effect-free — same contract as lib.mjs: no I/O, no randomness,
// so it is directly unit-testable and safely importable by the validator.
// Lives under `src/` (not a repo-root `scripts/` dir) so it ships in the
// published @stapel/tokens tarball and is reachable by the `stapel-tokens`
// bin — no host ever needs to vendor/fork this file (§68 Ф1 gate).

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parse a hex colour ("#fff" or "#ffffff") into an [r,g,b] triple (0-255).
 * Returns null for anything that isn't a plain hex literal (e.g. a custom
 * host role resolved to an rgba() value) — those are skipped, not warned on.
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
 * pairs implied by the §68 neutral role dictionary that must stay legible.
 * This is a curated list, NOT the full cross product of every role against
 * every other — most roles never actually sit on top of each other in the
 * UI, so a blind cross product would just be noise. Extend deliberately when
 * a new fg-on-bg relationship becomes real.
 *
 * Each entry: [fg role name, bg role name, "text" | "ui"].
 *   "text" → WCAG AA normal text, 4.5:1.
 *   "ui"   → large text / icon / meaningful graphical object / focus ring,
 *            3:1 (WCAG 1.4.11 non-text contrast + 1.4.3 large-text exception).
 *
 * ROLE-CATEGORY DECISION (2026-07-18, §68 Ф6): `border` and `border-subtle`
 * are DELIBERATELY ABSENT from this list. WCAG 1.4.11 itself only reaches UI
 * components/graphical objects that convey required information — it
 * explicitly carves out "a component that... is pure decoration, or has no
 * requirement of visibility" (and inactive/disabled chrome). By the §68
 * dictionary's own definitions `border` is "декоративная граница" and
 * `border-subtle` is "разделители" (a subtle divider, intentionally faint) —
 * neither conveys information on its own (no border-only affordance in this
 * system relies on hitting 3:1 to be perceivable; state is always carried by
 * a text/icon/fill change too). Gating them at 3:1 would be a false positive
 * against their own design intent, not a real accessibility gap. `focus-ring`
 * stays IN the list — a focus indicator is not decorative, WCAG 2.4.11/2.4.7
 * require it to be perceivable, and it has no accompanying text/fill change
 * to fall back on.
 */
export const CONTRAST_PAIRS = [
  // text on the surfaces it actually renders over
  ["text", "surface", "text"],
  ["text", "surface-sunken", "text"],
  ["text", "surface-raised", "text"],
  ["text-muted", "surface", "text"],
  ["text-muted", "surface-sunken", "text"],
  ["text-muted", "surface-raised", "text"],
  ["link", "surface", "text"],
  ["success", "success-bg", "text"],
  ["error", "error-bg", "text"],
  ["warning", "warning-bg", "text"],
  ["info", "info-bg", "text"],
  ["text-on-accent", "brand", "text"],
  ["success-on", "success", "text"],
  ["warning-on", "warning", "text"],
  ["error-on", "error", "text"],
  ["info-on", "info", "text"],
  // focus indicator — UI (non-text) contrast, 3:1 (a11y-critical, not decorative)
  ["focus-ring", "surface", "ui"],
];

const THRESHOLD = { text: 4.5, ui: 3.0 };

/** Build the exception lookup key for a (fg, bg, mode) triple. */
export function contrastExceptionKey(fgName, bgName, mode) {
  return `${fgName}:${bgName}:${mode}`;
}

/**
 * Check CONTRAST_PAIRS against a theme's resolved roles, in BOTH light and
 * dark. `resolvedCore` is `{ [role]: { light: hex, dark: hex } }` — the shape
 * `resolveTheme(...).core` already produces (minus the `*Ref` fields, which
 * are ignored here).
 *
 * A pair whose fg or bg role doesn't exist in this theme is silently skipped
 * — custom/host themes aren't required to define the full default dictionary
 * (frontend-guardrails §1.4). Same for a non-hex resolved value — contrastRatio
 * returns null and it's skipped, not warned.
 *
 * Returns an array of FAILURE records (not strings — the caller decides
 * error vs. warning depending on whether a documented exception covers the
 * pairing): `{ fgName, bgName, mode, kind, ratio, threshold, key, message }`.
 * `message` has no `⚠`/`✖` prefix — the caller/driver adds that, same
 * convention as elsewhere in the validator. `key` is the
 * `contrastExceptionKey` for this exact (fg, bg, mode) — match it against a
 * theme's `contrastExceptions` list to grant a documented escape hatch.
 */
export function checkContrastPairs(resolvedCore) {
  const failures = [];
  for (const [fgName, bgName, kind] of CONTRAST_PAIRS) {
    const fg = resolvedCore[fgName];
    const bg = resolvedCore[bgName];
    if (!fg || !bg) continue;
    const threshold = THRESHOLD[kind];
    for (const mode of ["light", "dark"]) {
      const ratio = contrastRatio(fg[mode], bg[mode]);
      if (ratio === null) continue;
      if (ratio < threshold) {
        failures.push({
          fgName,
          bgName,
          mode,
          kind,
          ratio,
          threshold,
          key: contrastExceptionKey(fgName, bgName, mode),
          message: `contrast: ${fgName} на ${bgName} (${mode}) = ${ratio.toFixed(1)}:1 < ${threshold} (WCAG AA)`,
        });
      }
    }
  }
  return failures;
}
