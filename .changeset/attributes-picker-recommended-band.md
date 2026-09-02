---
"@stapel/attributes-react": minor
---

A reference picker can put the RECOMMENDED terms first.

A `ref_select` sheet drew its level in whatever order the server sent, which in
practice is alphabetical. On a fifty-row manufacturer list that puts the six
makes almost every listing carries wherever the alphabet happens to leave them,
and the person scrolls a catalogue to find one of the six.

`VocabularyTerm` gains an optional `recommended?: boolean` — the wire's flag for
"this belongs at the top". Which terms carry it, and in what order they arrive,
stays the server's answer; this is the rendering half:

- **flagged** → two bands. The recommended terms first under their own heading,
  a rule, then the rest of the level under a heading of its own. The order
  INSIDE each band is the one the response sent.
- **unflagged** → exactly what it drew before: one plain list, no heading, no
  rule. No endpoint emits the flag yet, so this is the shape on screen today
  and it must not look like a form that failed to load.
- **search crosses both bands.** The filter is the server's, over the whole
  level, and the result keeps the two-band shape. A band with nothing left
  disappears with its heading; when nothing recommended survives, the list
  collapses back to the plain one rather than heading the whole level.

The flag is read strictly (`=== true`), so a wire that starts sending `0` or
`null` for "no" cannot promote a level wholesale. The bands are the picker
sheet's own groups — headings are never focusable or pickable, and arrow-key
traversal crosses the rule unchanged.

New on the main entry: `isRecommendedTerm` and `partitionRecommended`, for a
host drawing its own picker over the same seam. New copy in all three
catalogues: `attributes.picker.recommended`, `attributes.picker.all_options`.
