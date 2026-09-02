---
"@stapel/attributes-react": minor
---

Machine constraints reach the controls instead of being described beside
them — the owner's ruling on the car composer, in four mechanisms:

- **Progressive disclosure.** A field whose allowed set is scoped by a
  sibling (`optionsRef.parentFeature` — a chained ref rung, the
  vocabulary-backed int) does not render until that sibling is answered,
  and when the parent MOVES or empties the child's value resets and the row
  disappears (`undisclosedSlugs` in the new `disclosure.ts`, shared by
  `<FeatureFields>` and `toFeaturesDto`, so an undisclosed answer never
  rides the payload either).
- **The bake rule.** When a live constraint leaves exactly ONE allowed
  answer — a single-choice select down to one option (statically or via
  `forbid_option`), an int whose `limit` pins `min === max`, a chained rung
  whose parent has one child — the form commits it through the same
  `onChange` a user pick takes and the control renders grey with a reason
  line, `mandatory` or not. Un-bake is symmetric: when the collapse stops
  holding, a value the form (not the person) wrote is reset, never left
  standing as if chosen.
- **The vocabulary-backed int** (`IntConfig.optionsRef`, stapel-attributes
  0.8.2). Keypad AND dropdown together: typing filters the allowed set, a
  typed allowed number commits silently, a disallowed one opens the full
  set with a live bounds hint, and two steppers walk the set skipping gaps,
  greyed at the ends. The static range hint is suppressed — the control is
  the constraint. The same vocabulary edges are what the server refuses
  with, so the picker and the refusal cannot disagree.
- **Paging.** `VocabularyClient.search` gains an `offset` parameter and the
  sheets page through a long level on scroll-end (`useTermSearch.more`,
  de-duplicated by code, exhausted on a short or repeated page), on top of
  the server-side typeahead that already existed. An un-paged client
  degrades to the first page, never to a loop.
