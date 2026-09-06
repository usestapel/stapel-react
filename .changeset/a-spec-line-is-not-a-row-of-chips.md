---
"@stapel/listings-react": minor
---

A card's spec line stops printing a caption where a value is expected, and stops
captioning two axes identically (D421).

Measured on a live feed (translated): **"HONOR · Model 90 · 256 GB"** — three
facts, and the middle one reads as a value that begins with the word "Model";
and **"5 fl. · 9 fl. · 54 m²"** — the floor a flat is on and the number of
floors in the building, one number and its unit each, twice, with nothing
saying which is which.

Neither is a defect in the server's `presentation`: it was right about each
element ALONE. What it cannot see is where the text is PUT. A badge strip gives
every element a chip border; a spec line joins them with `" · "`, so a space
inside one item is not punctuation and a shared unit is not a distinction.

- **`CardBadgeStyle`.** `cardBadgeText(row, locale, style)` and
  `cardBadgeTexts(rows, locale, style)` take `"badge"` (the default — every
  existing call keeps its bytes) or `"line"`. The `name_value` pair is joined
  with a space in a chip, exactly as the 0.22 contract wrote it, and with a
  **colon** in a line: `"Model: 90"`, which is the punctuation that says what
  follows is the answer to this.
- **The collision pass.** Ambiguity is a property of the SET, so it is resolved
  once in `cardBadgeTexts`: elements printed without a caption that share a unit
  — or that print identical text — get their catalogue names back, in the
  `name_value` shape the contract already defines (`"Floor: 5 fl. · Floors:
  9 fl."`, and in a chip strip `"Floor 5 fl."`). It refuses to act where it
  would not help: a group whose names are missing, or that would wear one word
  twice, is left as the server wrote it rather than captioned with noise.

`<CardBadges variant="line">` — the spec line under every card's title — passes
`"line"`; the badge strip is byte-identical.
