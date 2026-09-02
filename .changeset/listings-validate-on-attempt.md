---
"@stapel/listings-react": patch
---

Refusals reach the fields on a SUBMIT ATTEMPT, not on a save (D54), and an
absent price is a sentence, never a zero (D51).

- `save()` no longer arms `showErrors`. Saves are housekeeping — the flat page
  saves on every blur, a staged host on every step change — and a draft is
  allowed to be incomplete; that is what a draft is. Arming the mirror there
  meant two or three red "field is required" lines under untouched fields
  before the person's first keystroke, on every step they entered. `publish()`
  still arms it, so a refused submit still names every field it refused.
- `<ListingPrice>` treats a `null` amount off the wire as absence rather than
  reading `.length` off it: with the server keeping a blank price null, the
  card and the detail page now render the catalogue's own no-price line
  instead of throwing or printing a zero. That line is reworded from "price on
  request" to "price not specified" in all three catalogues — a seller who
  skipped the field has not offered to negotiate.
