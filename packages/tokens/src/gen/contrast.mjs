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
// bin — no host ever needs to vendor/fork this file (§68 Phase 1 gate).

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
 * The fills a foreground role can sit on. Two lists, because the two
 * foreground families do not sit on the same things:
 *
 *  - TEXT_FILL_ROLES — every fill body text renders over: the four surfaces,
 *    the brand tint (a selected row, a highlighted panel) and the four status
 *    tints (an alert's body copy is `text`/`text-muted`, not the status colour).
 *  - UI_FILL_ROLES — the surfaces component chrome (an input's outline, a
 *    card's edge, a divider, the focus ring) is drawn on. A status alert's own
 *    outline is its `*-border` role, and a brand-tinted row has no outline, so
 *    the tints are not in this list.
 *
 * Add a fill here when a new place text or chrome sits on becomes real; the
 * cross product below picks it up in both modes.
 */
export const TEXT_FILL_ROLES = [
  "surface",
  "surface-raised",
  "surface-sunken",
  "surface-overlay",
  "brand-subtle",
  "success-bg",
  "warning-bg",
  "error-bg",
  "info-bg",
];
export const UI_FILL_ROLES = ["surface", "surface-raised", "surface-sunken", "surface-overlay"];

/** The neutral text family — body, secondary, tertiary and the two link
 * roles — WCAG AA normal text, 4.5:1, on every TEXT_FILL_ROLES fill. */
export const TEXT_ROLES = ["text", "text-muted", "text-subtle", "link", "link-hover"];

/**
 * Component chrome — WCAG 1.4.11 non-text contrast, 3:1, on every
 * UI_FILL_ROLES surface.
 *
 * `border` and `border-subtle` are IN this list (2026-09-14; reverses the
 * 2026-07-18 "decorative" exemption). The exemption read WCAG 1.4.11's
 * decoration carve-out onto the dictionary's own adjectives, but the roles
 * are not decorative where they are drawn: every design-system bridge maps
 * `border` to the outline of an input/select/button (antd `colorBorder`, MUI
 * `divider`) — the only thing that says "this is a field" — and
 * `border-subtle` to the line between rows and panes. Measured on a live
 * dark stand (video-react, 2026-09-14): `border` on `surface-raised` 1.70:1,
 * `border-subtle` 1.24:1 — an input with no visible edge. `focus-ring` stays,
 * for the same reason it always was.
 */
export const UI_ROLES = ["border", "border-subtle", "focus-ring"];

/**
 * Explicit contrast contract (user decision Q10a): the fg/bg pairs implied by
 * the §68 neutral role dictionary that must stay legible.
 *
 * Each entry: [fg role name, bg role name, "text" | "ui"].
 *   "text" → WCAG AA normal text, 4.5:1.
 *   "ui"   → large text / icon / meaningful graphical object / focus ring,
 *            3:1 (WCAG 1.4.11 non-text contrast + 1.4.3 large-text exception).
 *
 * The neutral text family and the chrome family are a CROSS PRODUCT against
 * their fill lists (before 2026-09-14 the list was hand-picked — `text` and
 * `text-muted` on three surfaces, `link` and `focus-ring` on `surface` only,
 * no `text-subtle`, no borders — and the pairs it left out were exactly the
 * ones a live stand failed on). The status and accent pairs stay explicit:
 * a status colour sits on its own tint, an `*-on` label sits on its own
 * solid fill, and the accent label sits on `brand`.
 */
export const CONTRAST_PAIRS = [
  ...TEXT_ROLES.flatMap((fg) => TEXT_FILL_ROLES.map((bg) => [fg, bg, "text"])),
  ...UI_ROLES.flatMap((fg) => UI_FILL_ROLES.map((bg) => [fg, bg, "ui"])),
  ["success", "success-bg", "text"],
  ["error", "error-bg", "text"],
  ["warning", "warning-bg", "text"],
  ["info", "info-bg", "text"],
  ["text-on-accent", "brand", "text"],
  ["success-on", "success", "text"],
  ["warning-on", "warning", "text"],
  ["error-on", "error", "text"],
  ["info-on", "info", "text"],
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
          message: `contrast: ${fgName} on ${bgName} (${mode}) = ${ratio.toFixed(1)}:1 < ${threshold} (WCAG AA)`,
        });
      }
    }
  }
  return failures;
}
