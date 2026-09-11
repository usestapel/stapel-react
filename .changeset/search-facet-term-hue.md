---
"@stapel/search-react": minor
---

A colour facet draws the colour the CATALOGUE knows.

The swatch has been on the rail since 0.38.0 and the live phones leaf never
drew one. `swatchColor(code)` resolves a design-system colour role, a CSS
keyword or a hex code, and a catalogue's colour code is none of those: the
leaf answers `chernyy`, `belyy`, `siniy` — its own transliteration — so the
axis was recognised, eleven values were captioned, and not one dot appeared.
That was the right answer for this package, because the hue was data it did
not have. The gap was in the wire, not in the control.

It is now in the wire. A vocabulary term has always carried the source
catalogue's own bag (`Term.extra`, `{"hue": "#1a1a1a"}` on a colour level);
stapel-vocabularies 0.4.1 exposed it through `terms_with_extra` on both
resolvers, and stapel-search 0.16.5 ships it on the search answer as
`facet_labels[<slug>].extras[<code>]`, beside the caption the panel already
reads.

**What this pair does with it.** `facetSwatch` asks the catalogue first —
`termHue(group, code)`, new and exported — and falls through to
`swatchColor(code)` exactly as before. The order is the whole design: the bag
is the only source that can ever be right about a transliteration, and the
name-resolving arms are the only ones that answer on a deployment where no bag
arrives. Both of those are ordinary — an older server, a resolver without the
wider read, a level whose terms carry nothing — and all three are
indistinguishable on the wire, which is correct, because none of them is
actionable.

`isColorAxis` gains a third source under the two guesses it already made: an
axis ANY of whose values carries a hue is a colour axis whatever its slug is
spelled. That is what reaches a catalogue mapping its colour to `tsvet` and
publishing it under a key neither `color` nor `colour` matches — the values
say what the slug does not.

**A bag is data, not a stylesheet.** Whatever a term carries goes through the
same `swatchColor` vocabulary a value code does before it can reach a CSS
property, so a `hue` of `url(javascript:alert(1))`, of `17`, or of anything
else this package would not accept from a value code resolves to `null` and
draws nothing. Every other key in the bag is the source catalogue's own and is
ignored.

`FacetGroup` carries the group's bags (`extras`, optional, absent when the
answer sends none or sends an empty map) so the rail, the chip row and the
popular-values block draw one value the same way without each re-deriving what
it looks like; `buildFacetGroups` fills it from the answer.

Regenerated against stapel-search v0.16.5 — `docs/schema.json` gains the
optional `extras` key on `FacetLabels`, and nothing existing moves. No new
prop, no new slot, no size raise: `default` measures 33.66 KB against the
34 KB line.
