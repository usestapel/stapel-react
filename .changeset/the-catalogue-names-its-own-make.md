---
"@stapel/attributes-react": patch
---

attributes: a feature can say which classified AXIS it is

Almost every feature DESCRIBES the object: a colour, a floor, a warranty. A
handful are the AXIS the classified is organised along, and a product has to
know which one that is before it can do anything — «more of this make» needs
the make feature of the leaf a listing sits in, an AI descent has to answer
make before model because each narrows the next, and a card printing "Toyota
Camry, 2019" is reading three axes rather than three arbitrary attributes.

Nothing in a `FeatureDef` said which feature that was, so every consumer kept
its own closed table of slugs — `{"brand", "make", "make_ref_select",
"vendor"}` in one storefront — and a catalogue that spelled the axis a fourth
way (`manufacturer`) dropped out of the feature silently: no link, no descent,
no error. A table of slugs maintained downstream of the catalogue is a table
that is always one catalogue behind.

**The catalogue answers instead.** stapel-attributes 0.9.2 gives `FeatureDef`
a closed, nullable `axis_role` (`make` | `model` | `generation` | `year` |
`mileage`), regenerated here by `gen:feature-def`, and `src/axis.ts` is the
browser half of `stapel_attributes/axis.py` beside it: `AXIS_ROLES`,
`axisRoleOf(definition)` and `byAxisRole(definitions)`. A consumer asks "which
feature here is the make?" and gets an answer or an honest `null`.

**A role two features claim is DROPPED, not resolved.** The reader has no
basis to pick between them and a link built off the wrong one sends a buyer to
a facet that is not the one they clicked, so `byAxisRole` omits the role
entirely — the same rule the producer applies one step earlier, where an
ambiguous leaf derives no role at all.

**An unknown role claims nothing, and does not throw.** Python's
`normalize_axis_role` raises, because there the value is being authored; this
side is reading a payload it did not write and has nobody to raise at — the
same asymmetry `featureVisibility` documents against `UnknownVisibility`. It
resolves to `null`, because a «more of this X» link built off a word nothing
here understands is worse than no link.

`AxisRole` is DERIVED from the generated `FeatureDef` rather than restated, and
`test/axis.test.ts` pins `AXIS_ROLES` to it through an exhaustive
`Record<AxisRole, true>`: a sixth role in the §68 canon fails the build here
instead of shipping an array one role short.

Contract pin: stapel-attributes v0.9.1 → v0.9.2. The announced range does not
move (`>=0.9 <0.10`).

Size: `dist/index.js` 9 → 9.25 KB, measured 8957 → 9072 B with dependencies
held constant. It is on the headless entry because its consumers are a link
builder and a descent, neither of which draws anything.
