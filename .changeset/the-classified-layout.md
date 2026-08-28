---
"@stapel/shell-react": minor
"@stapel/search-react": minor
"@stapel/listings-react": minor
---

The classified layout, in the default skins.

Built where the doctrine says the product lives, so every future classified
deployment gets it rather than rebuilding it.

- `shell-react` — `NavDock`, a floating translucent island rather than a flat
  bar: inset from every edge, real border and shadow, safe-area aware. The
  glass is progressive enhancement, not the design — the opaque elevated fill
  is the base and the blur is swapped in only inside an `@supports` for
  `backdrop-filter`, so text contrast never depends on transparency being
  available. Destinations are the first five top-level nav entries in the
  order the manifest already declares, so there is no second selection axis.
  Real links, `aria-current`, and the badge count folded into each link's
  accessible name.
- `search-react` — a phone gets a scrollable chip row instead of one
  "Filters" button, each chip opening its own `SkinDialog`, and chips carry
  the CHOICE rather than the group name. A desktop gets a sticky full-height
  rail. Both render through one `FacetGroupControl`, so the rail and the
  sheets cannot drift into two implementations — and a group's shape is
  derived from the schema keys the composer's editor already reads
  (`maxSelected: 1` → pills, `hierarchical_select` → indented children)
  rather than a new presentation flag. Plus a list/grid view switch, which is
  not URL state because it changes how an answer is drawn and never what it
  is.
- `listings-react` — the whole card is one real anchor: photo, price, title
  and location inside it, the favourite heart a sibling button outside it so
  the link cannot swallow it. The separate "open" control is gone and its
  i18n key is retired. Middle-click, open-in-new-tab and crawlers still work,
  and the anchor's accessible name is the title alone.

Parts of the reference layout that do not fit a generic contract are slots
with a stated reason rather than invented content: "notify me about new ones"
(a saved search has an owner, a schedule and a consent record this pair has
none of), the breadcrumb (a walk up a tree search cannot see), and map view
(a `SearchView` whose tiles belong to geo-react).
