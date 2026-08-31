---
"@stapel/listings-react": minor
"@stapel/attributes-react": minor
---

A published listing prints its option COPY wherever the copy exists, and the
composer's characteristics step is reachable on a phone.

**The copy.** A `select` DAO carries the chosen values and the display config,
never the option table — the table lives on the CATEGORY, and not needing it
is what lets a card draw a badge without a category read. A row written before
the server started snapshotting labels therefore had nothing to resolve
against, and the STORAGE SLUG reached the screen: a live classified deployment
printed `b-u`, `bez-defektov` and `ne-rabotaet-vspyshka` on its spec rows.
`featureFromDao(dao, { categoryFeatures })` adds the third and last source of
copy, with the precedence written out: a row carrying its own `options` table
is left alone, then the row's own `labels` snapshot, then the CATEGORY's
option table, then the raw value. The snapshot wins over the category on
purpose — it is what the listing was PUBLISHED with, and the whole reason the
server takes one is that a category edited afterwards must not silently
restate an old listing. A category def is used only when slug AND value type
match, so a renamed feature is ignored rather than forced, and a value the
catalogue no longer declares still prints itself rather than vanishing or
being invented. `hierarchical_select` gets the same repair, its tree adopted
whole because no positional snapshot can describe one. `<ListingDetailPane>`,
`<ListingCard>`, `<ListingSerpCard>`, `<ListingDetail>` and `useListingDetail`
take the optional `categoryFeatures`; a host that wires nothing is unchanged.

**The composer.** On a 390px viewport the characteristics of the chosen
category began about 1.8 viewports below the fold, under a 700px photo
dropzone, with no step indicator and nothing saying they existed — while the
footer counted ten unfilled required details, none of them on screen.

- Below `COMPOSER_STACKED_BELOW` the characteristics render directly under the
  category choice and ABOVE the photos; at or above it they stay where they
  were. The threshold is measured on the FORM's own width via `useElementWidth`
  — a composer in a 400px panel on a desktop is a narrow composer — and an
  unmeasured element falls to the wide arm.
- The placeholder said "loading the category's characteristics" when nothing
  was in flight and no category had been chosen. That is now its own fourth
  state with its own sentence, en/ru/es.
- `ListingComposerBag.firstUnsatisfied` names the first refused field in the
  form's own order, and the closed gate renders a real button (accessible
  name, focus AND scroll) that takes the person to it. A count of ten with
  nothing on screen is a dead end.
- A field showing a refusal now drops its hint instead of stacking on it: the
  refusal is the more specific statement and the one just earned.
- The whole attribute region carried exactly one test id. `attributes-fields`,
  `attributes-group-<group>`, `attributes-group-<group>-heading` and
  `attributes-row-<slug>` (with `featureSectionTestId` / `featureRowTestId`
  exported) make it measurable, and the row id sits on the same element with
  or without a host `renderRow`.
