---
"@stapel/attributes-react": minor
---

A bounded `int` is now a control a person can operate, not a caption over a
text box.

Every `int` with a bound — the config's `min`/`max`, a `limit` rule's, or both
— draws the keypad it already had PLUS a dropdown of the allowed values
(whenever the range is listable: ≤ 300, so 1900–2026 qualifies and a mileage
cap does not), steppers that grey at the ends, and the bound in words. Typing
a value that fits hides the list; typing one that does not opens the whole set
and says the bound — naming the answers that set it ("For G20 the value is
from 2018 to 2024") when a rule did, plainly when the catalogue did. When a
parent moves the bound out from under an answer, the answer is CLEARED with
the reason on screen; it is never coerced to the nearest end. One allowed
value still bakes.

`featureBounds(feature, values)` is the new seam behind that sentence: the
live `min`/`max` plus the controlling slugs of the `limit` rule that produced
them — the provenance `narrowConfig` correctly forgets and a hint cannot do
without. `<FeatureFields>` resolves those slugs to the answers a person reads
and passes them to the editor as `boundSources` (a new optional
`ValueEditorProps` member; every existing editor ignores it unchanged).
`ruleWhenMatches` and `conditionSlugs` are exported alongside it.

Bounds are still **replaced, never introduced** — a `limit` on a config that
declares no `max` yields no `max` — so the control constrains exactly what the
mirror refuses and what `stapel_attributes` refuses on save.

New i18n keys in all three catalogues: `attributes.int.out_of_allowed_for`,
`attributes.int.choose_value`.
