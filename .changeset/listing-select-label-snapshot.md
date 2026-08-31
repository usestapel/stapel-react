---
"@stapel/listings-react": minor
---

A stored `select` prints its option copy, not the storage slug.

A DAO carries the value and the display config, never the option table — the
table lives on the category, and not needing it is what lets a card render a
badge without a category read. `formatFeatureValue` resolves an option's copy
out of `config.options`, so with no table it fell through to `String(value)`
and the SLUG reached the screen: a live classified deployment printed
"Condition: b-u" on its spec rows and a subtitle of three slugs on its cards.

The identity table `featureFromDao` synthesized (`{value: v, label: v}`) only
ever answered for a TRANSLATABLE catalogue, whose labels are its keys. The
catalogues that produced those screens set `translatable_options: false` and
carry literal copy on the category, so `t("b-u")` returned `"b-u"` and there
was nothing else to fall back to.

- `featureFromDao` now builds the option table from the DAO's write-time
  `labels` snapshot — the `string[]` positionally aligned with `value` that
  `ref_select` has always carried and that `select` carries from the
  stapel-attributes release which snapshots option copy. The copy a listing was
  published with is the copy it prints, whatever the category has become since.
- A row written before that release carries no `labels` key and keeps the
  identity table exactly as it behaved: a translatable catalogue still reads
  out of the host's bundle, and a non-translatable one still shows the slug
  until the listing is re-projected. A visible slug gets fixed; an invented
  label ships wrong.
- A snapshot whose length differs from `value` is dropped WHOLE rather than
  paired over its overlap, which is the engine's own rule: one option's copy
  printed against another option's value does not look wrong.
- `ListingFeatureDao` declares `labels?: readonly string[]`.

Minor rather than patch: the fix rides on a new optional wire field and changes
what every listing surface renders. `ListingCard`, `ListingSerpCard`,
`ListingDetailPane` and the `ListingDetail` headless bag all split their DAOs
through this one function, so no surface needed its own patch — and a host
snapshotting card or detail output will see the labels change.
