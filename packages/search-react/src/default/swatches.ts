/**
 * A COLOUR FACET SHOWS THE COLOUR.
 *
 * The reference's colour group draws a filled dot beside every value; ours
 * drew the word and made the buyer read it (deep/elektronika-telefony.md §3,
 * the one rail regression that pass found). A colour is the one attribute
 * whose label is strictly worse than the thing itself — "silver" versus
 * "gold" in a catalogue's own transliteration is a paragraph of prose for a difference a 10px dot settles.
 *
 * Two questions, and each is answered conservatively, because both failures
 * are visible on a shopper's screen:
 *
 *  1. **is this axis a colour?** — {@link isColorAxis}, from the slug the
 *     catalogue mapped the axis to (and the address key, and `axis_role` if a
 *     schema ever carries one). A guess on the slug, exactly like
 *     `looksLikeExclusiveAxisSlug` next door: nothing on the wire marks an
 *     axis "colour", and inspecting the VALUES for colour-ish names would put
 *     dots on a paint-brand axis whose makes are called `Bordeaux`;
 *  2. **which colour is this value?** — {@link swatchColor}, and the honest
 *     answer is usually "nobody said". A value code is a catalogue's own term
 *     (`chernyy`, `dark-slate-2`) and neither the answer, the feature schema
 *     nor the vocabulary endpoint carries a hue for it. So the pair paints a
 *     dot only where the code IS a colour by a name it can resolve — the
 *     design system's own colour roles first (§68: one neutral vocabulary of
 *     ROLES, and it deliberately ships no hue ramp), then CSS's own colour
 *     keywords, then a code that spells the hue out in hex — and draws
 *     NOTHING otherwise. An invented mapping from a transliterated Russian
 *     word to a hex value is data this pair does not have.
 */
import { cssVar } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";

/** What {@link isColorAxis} needs of a group — the shape `FacetGroup` has. */
export interface ColorAxisLike {
  readonly slug: string;
  readonly urlKey?: string;
  readonly feature?: FeatureDef | undefined;
}

/**
 * The control-type tails a catalogue hangs on an axis slug when one feature
 * type is not enough to tell two mappings apart (`color_ref_select` is the
 * live phones leaf's own colour axis; `color_select` and `color_multi` are
 * the same axis under a different editor).
 *
 * Stripped before the head is read, so the control a value is PICKED with
 * cannot change what the value IS.
 */
const CONTROL_TAILS: readonly string[] = [
  "ref_hierarchical_select",
  "hierarchical_select",
  "ref_select",
  "multiselect",
  "multi_select",
  "select",
  "multi",
  "picker",
  "field",
];

function normalizeSlug(slug: string): string {
  let normalized = slug.toLowerCase().replace(/-/g, "_");
  for (const tail of CONTROL_TAILS) {
    if (normalized.endsWith(`_${tail}`)) {
      normalized = normalized.slice(0, -(tail.length + 1));
      break;
    }
  }
  return normalized;
}

/** The two spellings, and only as the slug's HEAD segment: `color_fridge` is
 * the colour of a fridge and `colorado_region` is a place. */
const COLOR_HEADS: ReadonlySet<string> = new Set(["color", "colour"]);

function headIsColor(slug: string | undefined): boolean {
  if (slug === undefined || slug === "") return false;
  const normalized = normalizeSlug(slug);
  const head = normalized.split("_")[0] ?? "";
  return COLOR_HEADS.has(head);
}

/**
 * Is this axis a colour vocabulary?
 *
 * Three sources, in the order of how much authority they carry:
 *
 *  - `axis_role` — the schema SAYING what an axis is, which is the only
 *    non-guess available. The canon's role vocabulary is closed and has no
 *    colour in it yet (`make`/`model`/`generation`/`year`/`mileage`), so this
 *    arm reads the field as text and is dead until the canon grows one. It is
 *    written now so that the day it does, nothing here has to change;
 *  - the axis slug, and the ADDRESS key beside it — the live phones leaf maps
 *    its colour to `color_ref_select` and publishes it as `color`, so either
 *    spelling alone would miss half the deployments.
 */
export function isColorAxis(group: ColorAxisLike): boolean {
  const role = group.feature?.["axis_role"];
  if (typeof role === "string" && COLOR_HEADS.has(role.toLowerCase())) return true;
  return headIsColor(group.slug) || headIsColor(group.urlKey);
}

/**
 * The design system's colour ROLES, for a value code that names one.
 *
 * The fleet's token vocabulary is neutral and role-shaped on purpose (§68):
 * there is no `red`, no `blue`, and no ramp — so a colour axis whose values
 * are hues matches nothing here, which is the correct answer rather than a
 * gap. What does match is a catalogue that codes STATES as colours (a
 * `status` axis mapped under a colour slug), and those take the brand's own
 * value in both themes rather than a frozen hex.
 */
const TOKEN_ROLE_SWATCHES: Readonly<Record<string, string>> = {
  brand: cssVar("brand"),
  error: cssVar("error"),
  info: cssVar("info"),
  link: cssVar("link"),
  success: cssVar("success"),
  surface: cssVar("surface"),
  text: cssVar("text"),
};

/**
 * CSS's own colour keywords — a NAME that matches, in the vocabulary every
 * browser already agrees on.
 *
 * The basic sixteen plus the extended keywords a product catalogue actually
 * uses. Deliberately not the full 148: every entry here is a promise that a
 * value code spelled that way means that colour, and `rebeccapurple` in a
 * phone catalogue is far likelier to be somebody's model name.
 */
const CSS_COLOR_KEYWORDS: readonly string[] = [
  "aqua",
  "beige",
  "black",
  "blue",
  "brown",
  "chocolate",
  "coral",
  "crimson",
  "cyan",
  "fuchsia",
  "gold",
  "gray",
  "green",
  "grey",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lime",
  "magenta",
  "maroon",
  "navy",
  "olive",
  "orange",
  "orchid",
  "pink",
  "plum",
  "purple",
  "red",
  "salmon",
  "sand",
  "sienna",
  "silver",
  "skyblue",
  "tan",
  "teal",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "yellow",
];

const CSS_COLOR_SET: ReadonlySet<string> = new Set(CSS_COLOR_KEYWORDS);

/** `#abc`, `#aabbcc`, `#aabbccdd` — a catalogue that codes the hue itself. */
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The CSS colour one value code names, or `null` for "nobody said".
 *
 * `null` is the ordinary answer and the row then draws no dot at all: a grey
 * placeholder beside eleven values would say "these are all the same colour",
 * which is worse than the word on its own.
 *
 * The code is read as written apart from case and separators — `dark_blue`
 * and `dark-blue` are one code and neither is a CSS keyword, so both get
 * nothing. Only a code that IS a name resolves.
 */
export function swatchColor(code: string): string | null {
  const raw = code.trim();
  if (raw === "") return null;
  if (HEX.test(raw)) return raw;
  const normalized = raw.toLowerCase().replace(/[-_\s]/g, "");
  const role = TOKEN_ROLE_SWATCHES[normalized];
  if (role !== undefined) return role;
  return CSS_COLOR_SET.has(normalized) ? normalized : null;
}

/**
 * The dot a value gets when this axis is a colour AND the value names one.
 * `null` everywhere else, which is most of the time — see {@link swatchColor}.
 */
export function facetSwatch(group: ColorAxisLike, code: string): string | null {
  return isColorAxis(group) ? swatchColor(code) : null;
}

/** The swatch's own size, in CSS pixels: a dot beside a line of text, sized
 * to the x-height rather than to the control, so it reads as part of the
 * label and not as a second checkbox. */
export const SWATCH_SIZE = 12;
