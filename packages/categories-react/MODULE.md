# @stapel/categories-react — module guide

Pairs with **stapel-categories 0.6.0** (`>=0.6 <0.7`), 23 paths under
`/categories/api/v1/`. Contract sources: the module's own
`docs/{schema,errors,flows}.json`, pinned in `contract-pins.json` and
regenerated under `pnpm gen:check`.

## Layers

```
src/api/          categoriesApi.ts   the five public reads; the one home of path strings
                  types.ts           wire aliases, and the one hand-mirrored field
                  generated/         openapi-typescript, drift-gated
src/catalog/      pks.ts             treenode's comma-joined pk columns
                  tree.ts            flat rows → tree, slug → node, breadcrumbs
                  sync.ts            the delta protocol as pure transitions
                  labels.ts          key-or-literal, per row
src/model/        runtime · context · queryKeys · catalogStore · catalogSync · queries
src/headless/     CategoriesProvider · CategoryTree · CategoryBreadcrumbs
                  CategoryCarousel · CategoryPicker · CategoryFeatures
src/default/      the antd skin, `./default` subpath
src/i18n/         keys · ru · es · errorsMap + generated/
src/nav/          manifest.ts
```

`catalog/` is pure: no React, no fetch, no storage. That is what lets the tree
assembly and the whole delta protocol be tested without a DOM, and what lets an
SSR render call them directly.

There is **no `flows/` layer**: `stapel-categories` annotates no `@flow_step`
and its `docs/flows.json` is `[]`, so the pair is not wired into `gen:flows`
(spec §8.1 — a flows layer only where a multi-step flow exists).

## The three server facts this package exists to absorb

### 1. There is no tree endpoint

Three shapes could serve a catalogue, and the right one for a storefront is the
paginated list: `GET /categories/` with `RevisionPagination`, envelope
`{pagination, revisions, results}`, rows ordered by `revision`. Each row
carries `tn_parent`, `tn_priority`, `tn_ancestors_pks`, `tn_children_pks`.

The ancestry columns are django-treenode `TextField`s holding **comma-joined
pks** (`treenode/utils.py`: `PKS_SEPARATOR = ","`), typed `string` in the
schema, `""` for a root. `parseTreenodePks` exists because the storefront spec
described them as arrays; a `JSON.parse` there fails, and a naive
`Number(column)` yields `NaN`, which fails every `===` against a real id and
therefore reads as "the parent is missing".

`buildCategoryTree` filters two flags the endpoint does not:

- `deleted` — the list's `include_deleted` defaults to **true**, and the delta
  protocol needs it that way.
- `active` — filtered server-side only by `/carousel/`. It is the storefront's
  visibility switch, so the public tree drops inactive rows by default and
  keeping them is an explicit option.

An unreachable row (a parent cycle in authored data) is promoted to a root
rather than dropped: a broken branch must be visible, not absent.

### 2. There is no slug lookup

`lookup_field` is never overridden and the list has no slug filter. `/c/:slug`
resolves against the synced tree. `Category.slug` is `unique=True` on the
model, so a collision cannot come from the database — it can only come from a
stale row in the client's own snapshot, and first-in-display-order wins
deterministically.

### 3. Names are translation keys

Covered in the README and in `catalog/labels.ts` at length. The short version:
`translate()` runs the `DISPLAY_TRANSLATOR` seam, its default is the identity
function, and **no serializer calls it** — the only two call sites are
`Category.__str__` and the admin's memoized feature label. `translatable`
(category) and `translate` (feature) say per row whether a string is a key.

`featureOptionsAreKeys` carries the third case, which is the one that bites
both ways: option labels are keys only under `translate: "all"` and only while
`config.translatable_options` is not false. Translating an opted-out option
shows the raw key; not translating an opted-in one shows the raw key too.

## The delta protocol, and the two rules the docs omit

The module's viewset docstring gives four steps: full GET, store
`revisions.global_max`, `?min_revision=`, drop `deleted: true`. Implemented
literally, that protocol has two holes.

**`deleted_ids` beats scanning rows.** `revisions.deleted_ids` is computed as
`filter(deleted=True, revision__gt=min_revision)` — unpaginated, over the whole
table, and reflecting the CURRENT flag (so a category deleted and then restored
is simply absent from it). The `deleted: true` rows, by contrast, are
paginated: a walk that stops early misses one. Both channels are applied;
`deleted_ids` is the complete one. On a full sync it is `[]` by construction —
the server only computes it when `min_revision` was sent — which is why
dropping `deleted: true` rows still matters.

**A multi-page walk must pin its window.** `paginate_queryset` filters at
request time and orders by `revision`; `global_max` is `Max(revision)` over the
table at response time. A write landing between two pages shifts every later
boundary. `max_revision` exists for exactly this and the documented flow never
mentions it: `nextPageRequest` pins the window to the first page's
`global_max`, and `applyCategoryPage`'s `cursorLimit` stops the cursor
recording anything past it. Whatever was written during the walk is picked up
by the next delta.

Beyond that, two loop guards:

- a **page budget** (`MAX_SYNC_PAGES`, 1000 — a million categories at the
  server's max page size), because a server-reported `has_next` bug is an
  infinite request loop against production, not a slow render; and
- **publish-on-completion**: a truncated walk rewinds its cursor to the stored
  one, so the worst case is one repeated full walk rather than a permanently
  incomplete tree.

The FULL/DELTA distinction is expressed as *what the accumulator starts from*
(`EMPTY_SNAPSHOT` vs the stored snapshot), not as a flag on the merge. A flag
invites both silent failures: a delta treated as full empties the catalogue, a
full treated as delta resurrects rows deleted while the client was away.

## Why the catalogue is app-scoped, not user-scoped

`createRepository` is the only sanctioned client-side persistence primitive,
and `scope` is not a size decision here. A user-scoped repository is encrypted
with the per-session key and wiped at logout with no opt-out — both wrong for a
category tree, which is public content identical for every visitor and for a
visitor with no session at all. App scope also means the store never asks for a
`SessionManager`, so it works on a page with no auth wired.

Every read and write is wrapped: a private window, cleared site data or a
snapshot written by an older shape all degrade to "no snapshot". A cold sync
costs one request; a cache that throws costs the page.

## The bridge to @stapel/attributes-react

`GET /categories/{id}/features/` is where the two packages meet.
`CategoryFeature` **is** attributes-react's `FeatureDef` — not a parallel type
— so `bag.features` feeds `<FeatureFields>`, `unsupportedTypeGate`,
`mirrorValidate` and `formatFeatureValue` unmodified. `test/features.test.tsx`
asserts that end to end: the rows this pair fetches go through
`unsupportedTypes` and it names the one type no builtin editor covers.

This pair adds exactly three decisions on top and no more: whether the name is
a key, whether the options are keys, and which rows are `show_as_badge` /
`show_at_title` projections. Value semantics — defaults, validation, formatting
— stay with the package that owns them.

## Navigation is a seam, not a dependency

Three of this pair's five skins exist to be clicked, and all three rendered
plain `<a href>`. In a SPA that is a full page load per click — and the
catalogue those links move between is already in memory, synced by delta into
an app-scoped repository, which is what most of this file is about. The
storefront could not use the chrome at all and said so (Wave D, G-4).

The fix is core's `LinkComponent`: a component over a plain `href`, so the pair
picks no router for its hosts. `src/default/CategoryLink.tsx` is the one place
that decides between the host's component and an anchor, and
`LinkComponentProp` is the prop every skin extends, so the spelling cannot
drift between three components.

One detail is load-bearing: antd's `<Breadcrumb items>` renders its OWN anchor
when an item carries `href`, which would bypass the seam from inside the
component it lives in. So a crumb's link is its **title**, and the item carries
no `href`. `test/linkComponent.test.tsx` asserts the consequence rather than the
prop — with a `linkComponent`, `container.querySelectorAll("a[href]")` is empty
on every one of these screens — and also that the CURRENT crumb stays a label,
because a link to the page under your feet is not navigation.

## Notes on the contract, recorded rather than worked around

1. **`FeatureConfig`'s discriminator is malformed, and the generated types are
   wrong because of it.** The schema declares
   `discriminator: {propertyName: "type", mapping: {"null": ConvertibleUnitConfig}}`
   — one bogus entry instead of the ten type slugs. openapi-typescript
   therefore (a) strips the discriminator from every use site, emitting
   `Omit<FeatureConfig, "type">`, and (b) re-adds a synthetic one per member,
   so the generated `IntConfig` declares `type: "IntConfig"` where the wire
   sends `"int"`. Feature configs are consequently typed through
   attributes-react's hand-mirrored `FeatureConfig` (itself pinned against the
   engine's generated golden corpus). **Upstream ask**: emit the ten slugs in
   `discriminator.mapping`, and both halves disappear.
2. **`FeatureCompact` carries no `revision`**, so the `/features/` collection's
   `RevisionPagination` envelope always reports `revisions.min/max: null`. Not
   on this pair's surface (a storefront reads features through a category), but
   it makes the parallel feature tree un-syncable by the same protocol.
3. **`POST {id}/validate-dto/` reads like a public helper and is not one.** The
   viewset is `ReadOnlyOrStaff`, which allows safe methods to anyone and
   everything else to staff — so this answers 403 to a visitor. It is absent
   from `CategoriesApi` for that reason, not by oversight.
4. **`include_deleted` is honoured** (`RevisionViewSetMixin.get_queryset`),
   despite being documented on the paginator, which ignores it. Its default is
   `true`.
5. **No `translations/` directory.** 20 of the 62 registry codes can never come
   from an upstream catalogue. They split by owner: the 42 cross-cutting
   `stapel_core` codes are generated from core's catalogue, the 8
   `stapel_categories` codes are authored in this pair's `./i18n/{ru,es}`, and
   the 12 `stapel_attributes` codes stay with `@stapel/attributes-react`, which
   already translates them. `test/i18n.test.ts` asserts over the UNION of the
   two bundles a host registers, so nobody can "fix" a red test by copying
   another package's twelve keys in and giving one refusal two sentences.

## Tests

119 in 9 files (115 in `test`, 4 in `test:pack`).

| File | What it holds down |
|---|---|
| `tree.test.ts` | flat rows → tree; priority order and its tie-break; both filters; orphan promotion; parent cycles; slug resolution incl. collisions; breadcrumbs cross-checked against the server's own `tn_ancestors_pks` |
| `sync.test.ts` | cold vs warm request; the `max_revision` pin; `deleted_ids` applied with no tombstone row present; cursor monotonicity and the window cap; snapshot parsing rejecting junk; the page budget and its cursor rewind |
| `labels.test.ts` | key vs literal for categories, features and option labels; a missing translation showing the key |
| `catalog.test.tsx` | loading / ready-empty / failed as three different sentences; "unknown slug" only after the catalogue loaded; the second mount asking for a delta |
| `features.test.tsx` | the attributes-react bridge, including `unsupportedTypes` over the un-reshaped payload |
| `skin.test.tsx` | the four `matchList` arms on screen; both blocked reasons named; searching without a request; ru copy |
| `i18n.test.ts` | every registry code resolving in en/ru/es over the union of the two bundles; ownership of the twenty un-catalogued keys; interpolation slots preserved |
| `pair.test.ts` | query-key namespace; the API surface being exactly the five public reads; nav ids, surfaces, routes and components |
| `prodBundlePurity.test.ts` | no demo/showcase code in the tarball |
