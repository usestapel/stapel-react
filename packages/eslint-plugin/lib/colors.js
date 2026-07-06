// Colour-syntax detection shared by no-raw-colors (ESLint) and the stylelint
// preset. Kept deliberately narrow so it only fires in colour CONTEXTS
// (style-object values, className arbitrary values, CSS templates) — never on
// arbitrary strings — to keep false positives near zero (frontend-guardrails
// §1.5: the anti-pattern is a hardcoded hex in a styled surface, not the
// substring "#abc" in an anchor href).

// #rgb, #rgba, #rrggbb, #rrggbbaa
export const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/;
// rgb()/rgba()/hsl()/hsla() function syntax
export const COLOR_FUNC_RE = /\b(?:rgba?|hsla?)\s*\(/i;

// A curated set of CSS named colours. Only checked when the value is the WHOLE
// value of a colour property (style objects / CSS decls), so "red" as an
// identifier or a word inside prose is never touched.
export const NAMED_COLORS = new Set([
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "gray", "grey", "cyan", "magenta", "lime", "teal", "navy", "maroon",
  "olive", "silver", "gold", "indigo", "violet", "coral", "salmon", "crimson",
  "turquoise", "beige", "tan", "brown", "aqua", "fuchsia",
]);

// CSS/React style property keys that carry a colour. Used to gate NAMED colours
// and to know a style value is colour-ish. Anything ending in "color" counts,
// plus these composite properties.
const COLOR_PROP_EXTRA = new Set([
  "background", "border", "outline", "fill", "stroke", "boxShadow",
  "textShadow", "borderTop", "borderRight", "borderBottom", "borderLeft",
  "box-shadow", "text-shadow", "border-top", "border-right", "border-bottom",
  "border-left",
]);

export function isColorProperty(key) {
  if (typeof key !== "string") return false;
  const k = key.trim();
  return /color$/i.test(k) || COLOR_PROP_EXTRA.has(k);
}

/** Any hex or colour-function token in a string (context already colour-ish). */
export function hasColorSyntax(value) {
  return HEX_RE.test(value) || COLOR_FUNC_RE.test(value);
}

/** Whole-value named colour (e.g. a style value of exactly "red"). */
export function isNamedColorValue(value) {
  return NAMED_COLORS.has(String(value).trim().toLowerCase());
}

/**
 * Scan a className string for Tailwind arbitrary values that embed a raw
 * colour: `bg-[#4657d9]`, `text-[rgb(...)]`, `border-[gray.500]`. Returns the
 * first offending fragment or null. `rampNames` lets us flag raw-ramp refs
 * (`gray.500`) that slipped into an arbitrary value.
 */
export function findArbitraryColor(className, rampNames) {
  const re = /(?:^|[\s])[\w-]*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(className)) !== null) {
    const inner = m[1];
    if (hasColorSyntax(inner)) return inner;
    // raw ramp reference inside the arbitrary value, e.g. bg-[gray.500]
    const ramp = /^([a-z]+)\.[\w-]+$/i.exec(inner.trim());
    if (ramp && rampNames && rampNames.has(ramp[1])) return inner;
  }
  return null;
}

/** True when a string looks like a bare raw-ramp reference: `<ramp>.<step>`. */
export function matchRampRef(value, rampNames) {
  const m = /^([a-z]+)\.[\w-]+$/i.exec(String(value).trim());
  if (m && rampNames && rampNames.has(m[1])) return m[1];
  return null;
}
