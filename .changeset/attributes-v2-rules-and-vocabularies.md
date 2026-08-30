---
"@stapel/attributes-react": minor
---

Conditional rules, form metadata and the two vocabulary-backed types — the
browser half of stapel-attributes 0.5.0.

**Rules.** `src/rules.ts` (main entry, React-free) mirrors
`stapel_attributes.rules`: `stringify`, `evaluateRules`, `narrowConfig` /
`narrowFeature`, `parseRules`, `ruleErrors`, `RuleState`. It is measured
against Python rather than reviewed against it — `test/rules.golden.test.ts`
runs all 59 state cases and all 10 pipeline cases of the corpus the engine
records from its own evaluator, copied here by `pnpm gen:rules` and drift-gated,
AND the whole generated Avito set from stapel-attributes 0.5.1: 3890 distinct
rules lifted out of a real catalogue, each at both polarities — 7780 frames,
15730 feature-state expectations, compared to what the Python evaluator wrote.
A rule is a transition and one frame cannot photograph one, so the pair is the
unit of evidence, and the corpus gate insists the two frames actually differ on
the rule-bearing feature and that all five effects (require / show / hide /
forbid_option / limit) appear. The two Avito files are copied BYTE FOR BYTE
(~12 MB, test-only, never packed) rather than re-serialized, so "this file IS
upstream's file" stays checkable.
Three behaviours that are decisions, not defaults: readings come from the
feature DEFINITIONS (a controlling slug the set does not declare reads as
`empty` even when `values` carries one), `narrowConfig` REPLACES a declared
`min`/`max` and never introduces one, and a malformed rule set THROWS
`FeatureRulesError` instead of reading as "no rules".

**The mirror.** `mirrorValidate` runs the pre-pass: a hidden feature is
accepted without being validated, requiredness is `RuleState.required` (never
`mandatory` alone), and the per-type rules see the narrowed config — so a
forbidden option comes back as `not_in_options` and a tightened bound as
`above_maximum`, with no new error vocabulary and no per-type special cases.
`featureAnswerRequired(feature, values?)` answers from the rule state when the
answers are in hand. `toFeaturesDto` drops a hidden feature's value, mirroring
`normalize_to_dao`.

**`<FeatureFields>`.** Hidden rows are not rendered; `required` comes from the
state; the editor is handed a feature whose config the rules already narrowed,
so editors stay rule-unaware and a host's own registered editor gets rules for
free. Sections come from `FeatureDef.group` (ordered by first appearance,
ungrouped rows first and unheaded), `description` becomes the field's help,
`example` the placeholder, `hints` one info alert per field.
`initialFeatureValues` prefers `FeatureDef.default` over the type's own.

**Vocabulary-backed types.** `ref_select` and `ref_hierarchical_select` bring
the registry to twelve, editable and formattable. Their config carries a
POINTER (`optionsRef {vocabulary, level, parentFeature?}`) instead of an
options list, so the terms arrive through the new `VocabularyClient` seam —
two functions, declared here and implemented structurally by
`@stapel/vocabularies-react`, neither package importing the other.
`ValueEditorProps.siblings` is how the child level learns its parent's code.
No provider is a LOUD state: the same notice a missing editor draws, and the
submit blocked through the same channel
(`unsupportedTypes(features, types, { vocabularyClient })`).

**Breaking, pre-1.0.** `FeatureDef.comment` is no longer rendered anywhere —
`description` is the field with that role (D14). `FeatureDef`, `Rule`, `Cond`,
`Hint` and `OptionsRef` are now GENERATED from
`stapel-attributes/docs/feature-def.schema.json` and re-exported rather than
described by hand, so `config` is required and `translate` is the canon's
closed vocabulary. `ValidationErrorCode` gains `invalid_rules`.

Requires stapel-attributes >= 0.5.
