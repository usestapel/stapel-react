---
"@stapel/listings-react": minor
---

listings: the reader's two actions are 44px again, the share menu is reachable on a desktop, a save claims only what it can claim, and the page takes its geometry from the host (D450, D455, D456, D457, §25)

**D450 — the hit-target rule now WINS.** Measured on the stand: the listing
page's heart and share glyph were **32 × 44**, and a card's heart **32 × 36**.
The block axis survived and the inline one did not, because antd's circle shape
ships `:where(…).ant-btn.ant-btn-circle.ant-btn{min-width:var(--ant-control-height)}`
— three classes — against this sheet's single `.stapel-listing-action`. A media
query adds no specificity and `:where()` adds none, so antd's 32 won at every
width and there was no viewport where the pair's floor applied.

`actionRowCss()` now writes the floor at a selector that outranks it: the class
repeated `LISTING_ACTION_SPECIFICITY` (4) times, and both spellings of each axis
(`min-inline-size` beside `min-width`) because the declaration being beaten is
the physical one. No `!important` — a host that wants a different target still
only needs a selector. `LISTING_ACTION_HIT` (44) and `LISTING_CARD_ACTION_HIT`
(36) are unchanged; what changed is that they take effect.

**Share prefers the MENU on a fine pointer (§25).** `navigator.share` is true on
desktop Chrome on macOS, so the capability probe sent every desktop share to the
OS sheet and this pair's copy-link menu — three networks and a clipboard row,
built for exactly that platform — was unreachable there. The arm now takes a
second reading, the primary POINTER, and a surface can overrule it:
`<ShareAction prefer>` / `useShare({ prefer })` / `<ListingActions sharePrefer>` /
`<ListingDetailPane sharePrefer>` take `"auto"` (default: the sheet only where
`(pointer: coarse)` matches AND the API exists), `"menu"` (this pair's menu on
every device) or `"native"` (the capability alone — the previous behaviour, kept
reachable by name). A missing `navigator.share` is the menu in all three.
`preferNativeShare()`, `hasCoarsePointer()` and `SHARE_COARSE_MEDIA` are exported
so the decision is readable rather than implied. **Behaviour change**: a desktop
that was getting the platform sheet now gets the menu; `prefer="native"` restores it.

**`features_draft` is omitted, not emptied, when there is no schema.**
`draftPatchFromValues(values, features)` walked the CATEGORY SCHEMA to build the
map, and `save-draft` REPLACES that map rather than merging into it — so a save
that left before the schema arrived spelled `features_draft: {}` and deleted every
characteristic the row was holding while the form on screen still showed them.
Measured by a live container over two cold loads of one draft: the reopen's own
settled-photo save fires in the first commit, before the row's category has been
adopted, and the row ALTERNATED between the draft's answers and none of them.
`{}` is a claim — "this listing has no characteristics" — and a caller with no
schema is in no position to make it, so the key is now omitted entirely (and
`features` accepts `undefined`). The general form of the same rule is the new
third argument: `draftPatchFromValues(values, features, { fields })` writes ONLY
the fields it names, so a partial save cannot replace what it is not claiming.
The value rules still apply inside the selection — naming `features_draft`
without a schema still writes nothing.

**D455 — "Model:: 90".** One card in twenty-four on a live feed carried a doubled
colon: the catalogue spells that leaf's name with the colon IN it and presents it
`name_value`, while the neighbouring listing's row for the same slug spells it
without and presents it `value`. Punctuation between a caption and its answer is
the SURFACE's decision (a space in a chip, a colon in a line), so a name arriving
with its own separator is normalised — `captionName()`, exported — before either
style joins it. Both spellings of one catalogue name now draw one caption, a
`name`-presented boolean loses its dangling colon too, and the two-axis
disambiguation compares names as they will be DRAWN.

**D456 — the sticky buy column pins under the host's chrome.**
`<ListingDetailPane buyTop>` (`layout="split"`) sets the column's sticky `top`,
a number as pixels or a string as written. The column carried an inline
`top: 16px`, which nothing short of `!important` could beat, so on a page with a
64px sticky header the top of the column — the price's own first twenty pixels —
sat under it at every scroll depth. Default unchanged. Same seam and same
spelling as `<SearchPage railTop>`.

**D457 — the measure is the host's when the host has a frame.**
`<ListingDetailPane measure>` sets the pane's own `max-width` (a length, or
`"none"` to remove the cap), like `<CategoryPage measure>`. Default is the
constant for the arm on screen, so no existing mount changes shape. Measured at
1440: the page's content ended at x=1224 with 216px of empty gutter beside it,
because a container that already holds the site's measure had a second, lower cap
inside it — and, the cap being inline, could only answer with
`min-inline-size: 100%` from outside.
