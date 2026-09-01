---
"@stapel/vocabularies-react": minor
---

A vocabulary level as a FIELD: `<VocabularyTermPicker/>`, the picker-sheet sibling of the term select.

The select stays exactly as it is, and that is the point. It is EMBEDDED — a
filter rail, an admin row, a bulk-edit cell hand it a width and expect the
inline control that sits beside the others — so turning it into a bottom sheet
would have changed those layouts without anybody asking. A phone FORM wants the
other shape: a 250px dropdown with the on-screen keyboard over half of it is the
case `SkinPickerSheet` exists for. So the sheet treatment ships beside the
select rather than through it, and a surface picks the one it wants.

The new control is a trigger that says what is chosen — the resolved LABEL for
one term, the count for several, and the stored code as the fallback, because an
empty field is a worse lie than a slug — opening a sheet that owns the search
box. On top of the list are the codes picked most recently (`useRecents` from
`@stapel/core`, scoped per vocabulary and level, drawn only while the box is
empty and only when it has something in it); a remembered code the vocabulary
can no longer name is dropped rather than rendered as a slug, since nobody asked
for that row. In `multiple` the footer carries the count it is about to keep,
and dismissing discards the draft instead.

Underneath, nothing new was invented: the same seam, the same debounced and
superseding `useTermSearch`, the same `useTermLabels` resolve, and the same
value on the wire — a list of codes, single-select included. `matched === false`
becomes the sheet's `listStale`, so a list that does not answer the box dims and
stops responding, recents included: reasoning per group about which rows happen
to be safe is how that rule got holes in it the first time.

Six demos at 390px, including the two states a wait actually has (a skeleton
when there is nothing to dim, dimmed history when there is), and the loud
no-client notice, which the picker draws for the same reason the select does.
New copy in en/ru/es. The peer floors move up to the release that carries
`useRecents` and `SkinPickerSheet`.
