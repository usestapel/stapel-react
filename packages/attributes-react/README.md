# @stapel/attributes-react

The React value layer for `stapel-attributes`' dynamic feature types: draw an
attribute, check it, submit it, display it.

## The axis — `config.type`, not `FormField.kind`

`stapel-attributes` has **two** field vocabularies, and mixing them up is the
one mistake this package exists to prevent:

| | vocabulary | who reads it |
|---|---|---|
| `FormField.kind` | the field kinds of the **admin form that configures a type** (`config_form.py`; `GET /forms/api/v1/field-kinds`) | [`@stapel/forms-react`](../forms-react) |
| `config["type"]` | the **value type** — `string`, `int`, `float`, `bool`, `select`, `date`, `header`, `hex_color`, `hierarchical_select`, `convertible_unit`, `ref_select`, `ref_hierarchical_select` | **this package** |

A person filling in a listing edits the second one. A useful consequence: a
storefront needs **no catalogue endpoint** for these types — the type arrives
in the data, on every feature that
`GET /categories/api/v1/categories/{id}/features/` returns.

## What kind of package this is

**L0, not a pair** — modelled on [`@stapel/image`](../image): no client, no
queries, no generated `schema.ts`. Its backend counterpart is an L1 library
with no HTTP surface at all (no models, no views, no urls), so there is no
`/attributes/api/v1/` to pair with and nothing for `pnpm gen:api` to read.
Feature definitions and validation verdicts reach a browser inside the
responses of the modules that own them (categories, listings), and those pairs
depend on this one to draw and check what they carry.

The builtin type set and the `ValidationErrorCode` vocabulary are pinned
against the engine's own generated corpora
(`stapel-attributes/tests/golden/{declarations,error_codes}.json`) by
`test/contract.test.ts` — always against the committed fixture, and
additionally against the live checkout when one is present.

## The ladder

```
explicit registerValueEditor(type, …)   ← a host's, always wins
→ BUILTIN_VALUE_EDITORS                 ← /default's antd editors, twelve types
→ <UnsupportedValueEditor/>             ← loud, never a skipped field
```

…and, while an undrawable feature is on screen, `unsupportedTypeGate` blocks
the submit **with the reason named**. That last rung is the point: a category
can legally carry a type this build has no editor for, and drawing nothing
would silently drop a feature that may be MANDATORY — the person would submit
a listing they could not complete and be told, by the server, that an
attribute they never saw is missing.

```tsx
import {
  featureErrorsBySlug, mirrorValidate, toFeaturesDto, unsupportedTypeGate,
} from "@stapel/attributes-react";
import { BUILTIN_VALUE_EDITOR_TYPES, FeatureFields } from "@stapel/attributes-react/default";

const gate = unsupportedTypeGate(features, BUILTIN_VALUE_EDITOR_TYPES);
const errors = featureErrorsBySlug(mirrorValidate(features, toFeaturesDto(features, values)));

<FeatureFields features={features} values={values} onChange={setValue} errors={errors} />;
<Button disabled={!gate.available}>…</Button>
```

Adding a type your backend registered through `EXTRA_TYPES` takes one line at
startup:

```tsx
registerValueEditor("size_grid", SizeGridEditor);
```

## The mirror

`mirrorValidate(features, dto)` returns the server's own
`ValidationBatchResult` shape, built from the same rules and reporting the
same `error.400.feature_*` keys — so a "too long" caught locally and one
caught by the server render the same sentence. It is feedback, never a
verdict: `POST /categories/{pk}/validate-dto/` and
`POST /listings/{pk}/publish/` decide.

Two contract details it gets right on purpose, both from
`stapel-attributes/MODULE.md` §"Pattern contract":

- `pattern` matches the **whole** value (`re.fullmatch`), not a prefix.
- string length is counted in Unicode **code points** on both sides — five
  emoji are five characters, not ten.

And two places it deliberately stands down, because a mirror that refuses what
the server accepts blocks a valid submit:

- a value type it does not know (it may be a perfectly good `EXTRA_TYPES`
  registration whose rules live only in Python) — it still checks
  mandatory/empty, which is type-independent;
- `convertible_unit`'s range, whose `min`/`max` are in the unit family's base
  unit and whose conversion table is server-side. The number and the unit code
  ARE checked.

## Value shapes that are not what you would guess

Four of the twelve types do not carry a bare scalar, and every one of them is a
submit that fails silently if you assume otherwise:

| type | wire value |
|---|---|
| `select` | **always a list**, even when `maxSelected: 1` |
| `date` | a **Unix timestamp (integer)**, not an ISO string |
| `hex_color` | an **object** `{simple, hex?, label?}` where `simple` is required and drawn from eighteen colour categories |
| `convertible_unit` | an **object** `{value, unit}` — the number as typed, tagged with the unit; the server converts |
| `ref_select` / `ref_hierarchical_select` | a **list of term CODES** — the labels live in a vocabulary and are snapshotted into the DAO at write time |

`toFeaturesDto` builds the `{slug: {type, value}}` envelope from a plain
`{slug: value}` map, tagging each entry from the FEATURE's config (never from
the editor — the engine overrides a client-sent `type` anyway) and dropping
headers, untyped rows, blanks and anything the RULES hide (the server drops a
hidden field's value too, so sending it would store an answer to a question
nobody was asked).

## Rules (stapel-attributes 0.5.0)

`FeatureDef.rules` is a closed grammar — five effects (`require`, `show`,
`hide`, `forbid_option`, `limit`), four operators (`in`, `not_in`, `filled`,
`empty`), two connectives, no nesting — evaluated in ONE pass over the raw
answers, so a rule cycle is impossible by construction.

```ts
const state = evaluateRules(features, values); // {slug: RuleState}
narrowConfig(feature.config, state[slug]);     // options dropped, bounds replaced
```

Two decisions worth knowing before reading the code: `narrowConfig` **replaces
a `min`/`max` the config already declares and never introduces one**, and a
`limit` rule's LAST match wins (limits replace, they do not intersect). A rule
set that breaks the grammar THROWS `FeatureRulesError` rather than reading as
"no rules" — the alternative draws a conditionally-mandatory field as
unconditionally optional because a rule had a typo.

`evaluateRules` is measured against Python, not reviewed against it:
`test/rules.golden.test.ts` runs the corpus `stapel-attributes` records from
its own evaluator (`test/fixtures/rules-corpus/`, generated by
`pnpm gen:rules`, under `gen:check`). `src/generated/featureDef.ts` comes from
the same canon through `pnpm gen:feature-def`.

`<FeatureFields/>` runs the pre-pass itself: hidden rows are not rendered,
`required` comes from the state, and the editor is handed a feature whose
config the rules already narrowed — so **editors stay rule-unaware** and a
host's own registered editor gets rules for free.

## Form metadata and sections

`FeatureDef` carries what an imported catalogue actually has: `description`
(help under the field), `example` (the placeholder, for the types with a text
box), `default` (what a blank form opens with — `initialFeatureValues`),
`hints` (one info alert per field, listed) and `group` (a section, ordered by
first appearance, ungrouped rows first and unheaded). All of them are
key-or-literal, like `name`. `FeatureDef.comment` is no longer rendered
anywhere: one field, one role.

## Vocabulary-backed types

`ref_select` and `ref_hierarchical_select` carry a POINTER
(`optionsRef {vocabulary, level, parentFeature?}`) instead of an options list,
because the lists do not fit in a category schema — a real phone catalogue is
529 vendors and 14 962 models. The terms arrive over a second wire, behind one
seam:

```tsx
<VocabularyClientProvider value={createVocabularyClient({ baseUrl })}>
```

`VocabularyClient` is two functions (`search`, `resolve`), declared HERE and
implemented structurally by `@stapel/vocabularies-react` — neither package
imports the other. A host with no vocabularies module supplies its own two
functions.

**No provider is a loud state.** The ref editors draw the same notice a missing
editor draws ("vocabulary source is not configured") and the submit blocks
through the SAME channel: `unsupportedTypes(features, builtinTypes,
{ vocabularyClient })`. An empty dropdown would be a mandatory attribute a
person cannot answer and is not told about.

## Display

`formatFeatureValue` is React-free and lives in the main entry, so a result
card can format a value without pulling antd in. `/default` adds
`<FeatureBadges/>` (the `show_as_badge` values as tags) and
`<FeatureValueList/>` (the whole spec table). Both keep the two absences
apart: "not specified" for a value nobody entered, and a named notice for a
type this build cannot read — an empty cell would claim the first when it
means the second.
