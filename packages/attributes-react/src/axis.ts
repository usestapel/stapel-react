/**
 * The axis role, browser side — mirrors `stapel_attributes/axis.py`.
 *
 * ── Why the axis exists at all ─────────────────────────────────────────────
 *
 * Almost every feature is a PROPERTY of the object being sold: a colour, a
 * floor, a warranty. A handful are not — they are the AXIS the whole
 * classified is organised along, and a product has to know which feature that
 * is before it can do anything with it:
 *
 *  - «More of this make» needs the MAKE feature of the leaf a listing sits
 *    in, to build the link;
 *  - a draft filled by an AI descent has to answer make before model, and
 *    model before generation, because each narrows the next
 *    (`optionsRef.parentFeature`);
 *  - a card printing "Toyota Camry, 2019" is reading three axes, not three
 *    arbitrary attributes.
 *
 * Nothing in a {@link FeatureDef} used to say which feature that was, so every
 * consumer kept its own closed table of slugs — `{"brand", "make",
 * "make_ref_select", "vendor"}` in one storefront — and a catalogue that
 * spelled the axis a fourth way (`manufacturer`) silently dropped out of the
 * feature: no link, no descent, no error. A table of slugs maintained
 * downstream of the catalogue is a table that is always one catalogue behind.
 *
 * So the axis is a property of the DEFINITION, decided once, by the catalogue,
 * and published with the schema (`FeatureDef.axis_role`, stapel-attributes
 * 0.9.2; resolved and served per feature by stapel-categories 0.21.0). A
 * consumer asks "which feature here is the make?" and gets an answer or an
 * honest `null` — it never has to guess from a slug again.
 *
 * ── Absence is the default and means nothing is claimed ────────────────────
 *
 * `null` is what every definition written before this axis existed says, and
 * what a feature that simply is not an axis says. It is never an error, and a
 * consumer must read it as "asked the catalogue for a role, got none" — not
 * as "this is not a make".
 *
 * ── An unknown value claims nothing, and does not throw ────────────────────
 *
 * Python's `normalize_axis_role` RAISES on a value outside the closed set,
 * because there the value is being authored and a typo must not reach the
 * wire. This side is reading a payload it did not write and has nobody to
 * raise at — the same asymmetry `featureVisibility` documents against
 * `UnknownVisibility`. It resolves to `null`: an unrecognised role is a role
 * this build cannot act on, and a «more of this X» link built off a word
 * nothing here understands is worse than no link at all.
 *
 * ── At most one feature per role ───────────────────────────────────────────
 *
 * Two features claiming `make` in one schema is a contradiction the reader
 * cannot resolve (which one does the link use?), so {@link byAxisRole} DROPS
 * the role rather than picking a winner — exactly as `by_axis_role` does. The
 * producer side (stapel-categories' derivation) does the same one step
 * earlier: an ambiguous leaf derives no role at all and says so.
 */
import type { FeatureDef } from "./types.js";

/**
 * Which classified axis a feature IS, when it is one.
 *
 * The vocabulary is CLOSED and small: these five are the axes a classified is
 * actually organised along; anything else is a property, and a property does
 * not need a name here to be useful. A sixth is a deliberate change to
 * `stapel_attributes/axis.py` and to every emitter of the canon, never
 * something a catalogue can introduce by inventing a value.
 *
 * DERIVED from the generated `FeatureDef`, never restated: `axis_role` is a
 * §68 canon key, and a hand-written copy of a closed set here is a second
 * source that goes stale the day the canon gains a sixth role. `AXIS_ROLES`
 * below is the runtime half, and `test/axis.test.ts` pins the two together.
 */
export type AxisRole = NonNullable<FeatureDef["axis_role"]>;

/**
 * Every accepted axis role, in DESCENT order — each one narrows the next.
 *
 * The order is the contract, not an alphabetisation: a form that fills a draft
 * top-down, and a breadcrumb that reads "Toyota › Camry › XV70", both walk it.
 *
 * This list and {@link AxisRole} are pinned to each other by
 * `test/axis.test.ts` against an EXHAUSTIVE `Record<AxisRole, true>`: a sixth
 * role landing in the §68 canon widens the type, leaves that record a key
 * short, and fails `tsc -p tsconfig.test.json` — before this array is shipped
 * one role behind the schema it claims to enumerate.
 */
export const AXIS_ROLES: readonly AxisRole[] = [
  "make",
  "model",
  "generation",
  "year",
  "mileage",
];

const KNOWN: ReadonlySet<string> = new Set<string>(AXIS_ROLES);

/**
 * The axis role of one feature definition, or `null` when it claims none.
 *
 * Takes anything with string keys, which is deliberate: a caller holds feature
 * definitions in two shapes (a payload row off the wire, a narrowed
 * {@link FeatureDef}) and neither should have to know which one it has — the
 * same tolerance `featureVisibility` and `dao_visibility` are written with.
 *
 * `undefined`, `null` and `""` all mean "nothing was said". So does a value
 * outside {@link AXIS_ROLES} — see this file's header for why that is `null`
 * here and a raise in Python.
 */
export function axisRoleOf(
  definition: FeatureDef | { readonly [key: string]: unknown } | null | undefined
): AxisRole | null {
  if (definition === null || definition === undefined) return null;
  const raw: unknown = definition["axis_role"];
  if (typeof raw !== "string" || !KNOWN.has(raw)) return null;
  return raw as AxisRole;
}

/**
 * `{role: definition}` over a category's feature definitions — the lookup a
 * storefront does INSTEAD of keeping a slug table.
 *
 * Given the schema of a leaf: which feature is the make, which is the model.
 *
 * A role claimed by two features is DROPPED, not resolved: the reader has no
 * basis to pick between them, and a link built off the wrong one sends a buyer
 * to a facet that is not the one they clicked. Absent from the result
 * therefore means "this schema does not name that axis" — the same answer a
 * schema that never claimed it gives, which is what a caller can act on.
 */
export function byAxisRole<T extends FeatureDef | { readonly [key: string]: unknown }>(
  definitions: Iterable<T>
): Partial<Record<AxisRole, T>> {
  const seen = new Map<AxisRole, T>();
  const ambiguous = new Set<AxisRole>();
  for (const definition of definitions) {
    const role = axisRoleOf(definition);
    if (role === null) continue;
    if (seen.has(role)) {
      ambiguous.add(role);
      continue;
    }
    seen.set(role, definition);
  }
  // Built from the survivors rather than by removing the losers: a dropped
  // role must be ABSENT (`"make" in axes === false`), not present and
  // undefined — a caller spreading this into a lookup would otherwise shadow
  // a role it means to fall back on.
  const roles: Partial<Record<AxisRole, T>> = {};
  for (const [role, definition] of seen) {
    if (!ambiguous.has(role)) roles[role] = definition;
  }
  return roles;
}
