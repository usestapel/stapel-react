---
"@stapel/listings-react": minor
---

A refused save is read on the control that caused it, not as a wall.

`save-draft` and `create` answer a bad field with the ordinary error envelope
carrying `params.field`, not with the publish batch — and only the batch had a
door into the composer's per-control routing. So a draft refused for one
over-precise coordinate painted two identical "Validation error" plaques over
the footer (a publish saves first, so both failures were the same 400) and
left all thirty-odd controls clean. The field name was in the response the
whole time, and is often the only thing in it that says what went wrong: a DRF
code the error registry does not know collapses to the generic
`error.400.validation_error`, whose sentence is "Validation error" and nothing
else.

- New `envelopeFieldErrors(thrown)` maps an envelope's API field name onto the
  control that holds it — including both halves of the coordinate pair onto
  the one location field — and is exported for hosts that render their own
  composer.
- `useListingComposer().fieldErrors` now carries save/create refusals as well
  as publish-batch ones.
- `ListingComposerPage` banners only what has nowhere else to go: a refusal
  that reached a control is read there, once.
