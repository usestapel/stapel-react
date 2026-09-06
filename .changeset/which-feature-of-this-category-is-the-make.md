---
"@stapel/categories-react": patch
---

categories: the catalogue says which feature of a category is the make

stapel-categories 0.21.0 resolves an axis role per feature — an authored value
first, then `load_catalog`'s slug-table derivation — and serves it on every
public feature read as `axis_role`, with `axis_role_authored` /
`axis_role_derived` on the editor serializer. `docs/schema.json` moves, so
`src/api/generated/schema.ts` regenerates against the new pin.

**What a host can now read.** `CategoryFeatureEntry` gains `axisRole`
(`"make" | "model" | "generation" | "year" | "mileage" | null`) and
`CategoryFeaturesBag` gains `axes` — `{role: feature}` over the category's
schema, which is the lookup a storefront does instead of matching slugs
against a table of its own. The raw rows `useCategoryFeatures` and
`bag.features` hand on carry the key untouched, and `AxisRole` is re-exported
so a host names the type without depending on `@stapel/attributes-react`
directly.

**No UI.** `<CategoryFeatureList>` draws no axis badge; the skin's byte cost
is the two extra fields travelling through the bag.

**The vocabulary stays where it is owned.** Both readers are
`@stapel/attributes-react`'s `axisRoleOf` / `byAxisRole`, so a role this build
does not recognise reads as `null` rather than reaching a renderer as
something nothing can act on, and a role TWO features claim is dropped rather
than resolved — a «more of this make» link built off the wrong one sends a
buyer to a facet they did not click. The features themselves still arrive,
drawn and validated and faceted exactly as before: an unusable ROLE is not a
dropped feature.

The defect this ends is silent. A storefront's own table (`brand` / `make` /
`vendor` / `manufacturer`) is always one catalogue behind, and a catalogue
spelling the axis a fifth way produced no link and no error.

Contract pins: stapel-categories v0.21.0 → v0.21.1, stapel-attributes v0.9.1 →
v0.9.2 (0.21.1 raises the module's own floor to 0.9.2 for this field, which is
why the two move together). Neither announced range moves — still
`>=0.21 <0.22` and `>=0.9 <0.10`.

Peer floor: `@stapel/attributes-react` `>=0.1.0` → `>=0.16.6`. The three
symbols this pair now imports (`AxisRole`, `axisRoleOf`, `byAxisRole`) ship in
that release, and the monorepo cannot catch a stale floor by building — in
here every package compiles against the workspace peer, never against its own
floor.

Size: `dist/index.js` 10.45 → 10.75 KB, measured 10445 → 10582 B with
dependencies held constant; `dist/default/index.js` 17.8 KB holds at 17725 B.
