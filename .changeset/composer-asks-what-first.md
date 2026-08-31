---
"@stapel/listings-react": minor
"@stapel/attributes-react": minor
---

The composer asks what is being sold before it asks about the parcel

`<ListingComposerPage>` had two section orders chosen by the form's width, and
the narrow one put the category's characteristics directly under the category
picker. On a leaf with a handful of attributes that was an improvement; on an
imported one it was a funnel with nothing left in it. Measured at 390x844 on a
live classified deployment: 32 fields between the category and the title, so
`Title` sat at y=5575, `Price` at y=5871 and `Photos` at y=6245 of a 7308px
form — the seller was asked for the parcel's weight, its length and "what the
goods are measured in" before being asked what the thing is or what it costs.

There is now ONE order, at every width, and it belongs to the component:

    category → title → description → price → currency → where → photos →
    the category's characteristics → the listing's own options

Measured on the showcase's own composer story at 390 (five attribute rows, not
32): title moves 993 → 314, the first attribute row 412 → 1266, and the page
shortens 2227 → 2071px.

- `COMPOSER_STACKED_BELOW` is gone, and with it the width measurement that
  chose between the two orders. `COMPOSER_DETAILS_PLACEMENT` replaces it: a
  constant, exported because `data-placement` on the characteristics region is
  what an e2e suite reads to prove the order has not regressed.
- The discoverability the narrow order was reaching for is kept by the two
  things that do not move the questions around — "take me to the first empty
  field", which now also OPENS whatever disclosure the field is folded inside,
  and a shorter region.
- `<FeatureFields>` takes `groupCollapse` (`"none"` by default, unchanged for
  every existing host; `"auto"` in the composer). Under `"auto"` each named
  group is a native `<details>` that starts open when it asks something
  required or something already answered, and closed otherwise — so identity
  groups are open and the delivery dimensions and wholesale terms are one tap
  away under their own headings. The rule reads the SCHEMA and never a list of
  group names: groups are admin-authored text in the deployment's language.
- The group order the catalogue emits is untouched.
