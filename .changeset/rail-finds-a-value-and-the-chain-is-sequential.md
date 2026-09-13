---
"@stapel/search-react": minor
---

The rail FINDS a value instead of opening a dropdown, a chained axis waits for the rung above it and says so, and the makes block's «all of it» link rides with its caption.

Three things the founder read on the live site on 2026-09-13, all of them on a
cars leaf and none of them about cars.

**The rail's dictionary axis is the box and its values.** `<SearchPage>`'s
per-layout default for the column layout was `dictionaryMode="field"`: a
select-shaped button reading *Any* with a chevron, which had to be pressed
before anything could be typed. That is one press between a reader and every
dictionary axis on the page, and the reference classified puts none there — its
make axis is a box captioned *enter a name* with the popular values listed
under it, open from the first frame. The default is now `"inline"`. The
objection the field was introduced for — a 418-value vocabulary held open is
the whole of a 280px rail — is answered by the fold the inline body already
has: measured in headless Chromium in a 280px column, the axis is 310px tall,
eight rows and a *Show all*, with nothing overflowing the rail. `"field"` is
still there for a host that asks for it by name, so this is not a deletion.

**The chain is strictly sequential.** A catalogue may scope one axis by another
(`config.optionsRef.parentFeature`): a model level enumerates the models of one
make, and with no make chosen the level is every model of every make. The
composer has refused to draw such a field since `dependencyParentOf` shipped;
the search side had no rule at all, so a model could be picked with no make and
the press led to an empty feed. `buildFacetGroups` now stamps
`FacetGroup.awaitingParent` — the parent's slug and its heading — on any axis
whose parent carries no value, and every surface that draws facets reads it:
the desktop rail, the phone filter sheet and `<PopularValues>`. The rule lives
in the MODEL for that reason; a rule applied in one control is a rule the other
two disagree with.

A gated axis is NOT unmounted, which is where this differs from the composer's
answer to the same pointer: a filter rail is a map of the axes a category has,
and one that vanishes and reappears as you choose is a rail that moves under the
reader. It keeps its heading, its box is `disabled`, its option rows are drawn
and switched off, and a line under it NAMES the axis to answer first
(`search.facets.parent_first`, in all three locales). Nothing about makes or
models is hard-coded: a catalogue that chains four levels gets four rungs, one
that chains none gets none, and a pointer naming an axis this page does not have
gates nothing — a control switched off by a slug nobody can answer is switched
off forever.

New in the headless entry: `facetParentSlug`, `resolveFacetParents`,
`FacetParentGate`, and `FacetGroup.awaitingParent`.

**`<PopularValues>`' «all of it» link moved into the caption's row.** It was
under the columns at the start edge, which on a four-column block of twelve
makes is three rows and a gap below the only words that say what the block is;
two reviewers walking the storefront missed it, and the reference puts it
immediately after the caption on the caption's own baseline. Measured in
headless Chromium at 390, 768 and 1440: the link now sits 12px after the
caption, on its line, above the values, in the brand colour.
