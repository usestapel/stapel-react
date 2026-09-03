---
"@stapel/attributes-react": minor
---

A value predicate is false of a value that is not there.

`evaluateRules` no longer matches `in` or `not_in` against a controller that
reads empty — `null`, `""`, `[]`, an envelope with a null value, or a slug the
feature set does not declare. `in` already behaved this way by accident (`some`
over no strings is false), so the change lands on **`not_in` alone**, which used
to be _true_ on a blank field and starred every field behind a
`require when X not_in […]` rule before anyone had answered `X`.

Two independent UX walkers hit the same wall on a live catalogue: a field marked
`*` and refusing "Next" while its own help line said "required **if** you said
in field _Kit_ that there is a box", with _Kit_ untouched. The screen had no
honest exit — the seller either lied or stopped.

`not_in` is a question about the answer a person gave, and an unanswered field
has no answer to compare; "the value is not X" cannot be true where there is no
value. The closed grammar already carries the operators for the other question,
so an author who means "not answered yet, **or** not X" writes it:

```json
{"effect": "require",
 "when": {"any": [{"feature": "condition", "op": "empty"},
                  {"feature": "condition", "op": "not_in", "values": ["new"]}]}}
```

`stringify` did not move: `false` is still _filled_ (`["false"]`), so
`not_in ["true"]` still fires on it, and `empty` / `filled` answer exactly what
they did before. The change is in the condition, so it reaches every effect the
same way — an unmatched rule leaves `show` shut, `hide` open, `require` silent,
`forbid_option` banning nothing and `limit` narrowing nothing. Everything
derived from the state follows: `featureRuleState`, `featureAnswerRequired`,
`missingRequiredFeatures`, `visibleFeatures`, `visibleFeatureGroups`,
`narrowFeature` and `mirrorValidate`.

This is a semantics change shared with the Python engine, and the two are
measured equal rather than reviewed equal. The corpus regenerates from
`stapel-attributes` 0.9.0 (pin bumped, `contract` `>=0.9 <0.10`): 59 → **70**
state cases, the new eleven covering both value operators on an unanswered
controller, `not_in` on each empty payload shape and on a false bool, every
effect's own default under an unmatched condition, and `any: [empty, not_in]`.
`require-when-not-in-empty-value` keeps its name and now records the opposite
verdict — the shared corpus had been pinning the defect. The generated imported
set (3890 distinct rules at both polarities, 7780 frames, 15730 recorded
expectations) is byte-identical across the bump.

Blast radius on the imported catalogue this ships against — measured, not
estimated — is 3 `not_in` rules over 4093 conditions: 22 feature-rows in 2
leaves, 984 changed feature-state cells across 498903 sampled assignments, 13
rows changed on a blank form (7 of them no longer required), and **zero**
features made unreachable or newly reachable.
