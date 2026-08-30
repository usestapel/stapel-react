---
"@stapel/listings-react": minor
---

The composer reads the rules, the catalogue's defaults, and the vocabulary
source.

- **A category's defaults reach a blank draft.** `initialFeatureValues` is
  applied when the schema lands, only for slugs the draft has no answer for —
  a reopened listing outranks a default, because a default is a suggestion and
  an answer is not. It runs once per feature SET, so a default is not re-seeded
  over a field the person then cleared.
- **The publish gate's required check is the RULE STATE.** A mandatory feature
  the rules hid no longer blocks a publish for an answer nobody can give, and a
  feature a `require` rule turned on blocks one though `mandatory` is false.
- **A missing vocabulary source blocks through the "unsupported" channel.** The
  composer reads `useVocabularyClient()` and hands it to `unsupportedTypes`, so
  a `ref_select` with nothing to resolve it raises the same
  `listings.compose.blocked.unsupported_type` a type with no editor raises.
  One dead control, one reason, no second channel — wire
  `<VocabularyClientProvider>` around the composer and it goes away.

`featureFromDao` narrows `translate` to the canon's closed vocabulary
(`all` / `title` / `none`) instead of passing any string through.

Requires @stapel/attributes-react >= 0.4.
