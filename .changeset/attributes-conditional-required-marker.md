---
"@stapel/attributes-react": minor
---

Requiredness and emptiness are verdicts about the current ANSWERS, and a host
can now ask for both.

A composer that walks a category in steps had to re-derive two things by hand,
and read them off the schema: whether a block still asks anything (a block
whose fields are all rule-hidden produced a step with a heading and nothing
under it) and what the person still owes (a "Next" that refused over a field
that was not on screen, with no way past it but a false answer). New on the
main entry, all evaluated against the values:

- **`missingRequiredFeatures(features, values)`** — the required-and-still-blank
  rows. Requiredness is the evaluated rule state, so an unmatched `require`
  rule is not required, and it is the SAME predicate the asterisk and the
  mirror use.
- **`visibleFeatures(features, values)`** — the rows `<FeatureFields>` will
  draw, both gates composed (rules `show`/`hide` and progressive disclosure).
- **`visibleFeatureGroups(features, values)`** — those rows as blocks, in the
  skin's own order, with every block that asks nothing dropped: the step ladder,
  ready to walk. Headings do not count as questions.
- **`hasVisibleFields(features, values)`** — the one-line form of the same
  question.
- **`featureRequiredUnder(feature, state)`** — the requiredness predicate
  itself, now public. `<FeatureFields>` had its own copy beside the mirror's;
  the marker and the refusal are one function call again, so they cannot drift.

Fixed with them: `mirrorValidate` no longer reports a field that progressive
disclosure has not revealed as `mandatory_missing`. `toFeaturesDto` already
drops such a value as "not part of the declaration", so the mirror was refusing
a payload it had built itself and naming a control the person could not see.
The open question there is the parent.
