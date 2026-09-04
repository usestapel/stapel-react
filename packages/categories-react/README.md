# @stapel/categories-react

The frontend pair for **stapel-categories**: the catalogue tree a storefront
navigates by, kept fresh with the module's own revision-delta protocol instead
of being refetched on every page.

The backend has **no tree endpoint** and **no slug lookup**, and it serves
category names as **translation keys**. This package is where each of those
three facts is handled once, in the open, rather than rediscovered by every
host.

Business + state in the main entry, zero visual opinion; the antd skin lives
behind `./default`. Built on `@stapel/core` (typed client + `StapelApiError`
envelope, `LoadState`, `createRepository`, i18n engine, TanStack Query) and
`@stapel/attributes-react` (the feature schema's value types).

## Install

```
pnpm add @stapel/categories-react @stapel/core @stapel/attributes-react @tanstack/react-query react
# for the default skin:
pnpm add antd @stapel/tokens-antd
```

## A catalogue, in six lines

**No session, no workspace id, no auth client** — every endpoint this pair
calls is a safe method under `ReadOnlyOrStaff`, so the catalogue renders for a
visitor who will never sign in:

```tsx
import { createCategoriesRuntime, CategoriesProvider } from "@stapel/categories-react";
import { CatalogPage } from "@stapel/categories-react/default";

const runtime = createCategoriesRuntime({ baseUrl: "/categories/api/v1/" });

export function CatalogRoute() {
  return (
    <CategoriesProvider runtime={runtime}>
      <CatalogPage />
    </CategoriesProvider>
  );
}
```

## The client builds the tree, because the server has none

`GET /categories/` returns **flat rows ordered by `revision`** — a sync feed,
not a menu. Ancestry rides along in django-treenode's columns, which are
**comma-joined primary-key strings**, not arrays:

```jsonc
{ "id": 4, "slug": "used-phones", "name": "category.used_phones",
  "tn_parent": 2, "tn_ancestors_pks": "1,2", "tn_children_pks": "" }
```

`buildCategoryTree(rows)` assembles the hierarchy, orders siblings by
`tn_priority` descending (ties by id, so a catalogue that never set priority
does not reshuffle between renders), and drops two kinds of row the endpoint
happily serves: soft-deleted ones, and **inactive** ones — `active` is filtered
server-side only by `/carousel/`.

A row whose parent is missing becomes a root rather than disappearing. Dropping
it would delete a live branch of the catalogue from the menu and give nobody a
reason.

## The catalogue is synced by delta, not refetched

The module documents the protocol on its own viewset: full GET → store
`revisions.global_max` → later `?min_revision=<stored>` → drop what comes back
`deleted: true`. This package implements it into an **app-scoped repository**
(`createRepository(..., { scope: "app" })` — the one sanctioned persistence
primitive), so a second page costs one small delta request instead of the whole
catalogue.

Two rules the documentation does not state are implemented anyway:

- **`revisions.deleted_ids` is the complete tombstone channel.** The
  `deleted: true` rows are paginated, so one can sit on a page a short walk
  never reached; `deleted_ids` is computed unpaginated over the whole table.
  Both are applied; the list is the one that is complete.
- **A multi-page walk pins `max_revision`.** Pages are ordered by revision and
  filtered at request time, so a write landing between page 1 and page 2 shifts
  every later boundary and the walk skips a row. The window is pinned to the
  `global_max` the first page reported, and the cursor never records reading
  past it.

A walk stopped by its page budget reports `truncated` and **rewinds its
cursor**: the rows are still shown, but the next sync redoes the walk rather
than sitting a delta on top of a catalogue that was never fully read.

## `/c/:slug` is resolved on the client

`CategoryViewSet` never overrides `lookup_field` and the list endpoint has no
slug filter, so `GET /categories/<slug>/` is a 404 and `?slug=` is ignored. The
storefront's `/c/:slug` resolves against the synced tree —
`resolveCategorySlug(index, slug)` — which is a second, independent reason the
tree is cached.

A slug is not "unknown" until the catalogue has actually loaded. Rendering
"there is no category here" during a sync shows a 404 for a page that exists.

## Names are translation KEYS

This is the fact most likely to be got wrong, so the package states it in the
types instead of in a comment.

`stapel-categories` stores keys and never owns a catalogue. Its
`DISPLAY_TRANSLATOR` seam is called from `Category.__str__` and the admin's
label cache — **no serializer calls it**. So a category arrives as
`{"name": "category.electronics"}` even on a deployment with a real translator
configured, there is no `?lang=`, and `GET /translation-keys/` is a
service-only extraction feed for translators, not a resolver.

Which strings are keys is declared per row, and the pair reads the flag rather
than guessing:

```tsx
categoryLabel(category)   // { kind: "key" | "literal", value }  ← `translatable`
featureLabel(feature)     // `translate: "none"` makes the name a literal
featureOptionsAreKeys(f)  // `translate: "all"` AND config.translatable_options
renderCategoryLabel(label, t)
```

The resolution goes through the **host's** i18n engine, and this package ships
no category names: a catalogue is a deployment's content, not a library's
chrome. When a key does not resolve, the key is shown — deliberately. A visible
`category.electronics` gets fixed; a prettified "Electronics" invented by the
library ships for a year in the wrong language.

## The feature schema, and where attributes-react takes over

`GET /categories/{id}/features/` resolves inheritance and order server-side and
returns the polymorphic attributes config **verbatim** — not through
`get_config_with_defaults()`, so an absent key means "the type's default", and
`@stapel/attributes-react` owns those defaults. `<CategoryFeatures>` hands the
rows over unmodified:

```tsx
<CategoryFeatures categoryId={id}>
  {(bag) => (
    <FeatureFields features={bag.features} values={values} onChange={set} />
  )}
</CategoryFeatures>
```

The same `bag.features` is what `@stapel/search-react`'s facet panel takes as
`categoryFeatures` to caption facet values.

### A `chips` parent with no features of its own: `effectiveFrom` and `divergent`

Since stapel-categories 0.20.1, a `chips` parent that declares no features
answers the **effective** schema instead of an empty one: the intersection of
its children's, so the parent — which renders the feed and the chip row for
all of them — has something to draw before a chip narrows the choice. The
response says which schema it sent with an `X-Effective-From` header, which
`StapelClient.get` cannot see; this pair reads it over a small `fetch`
carve-out (`api/featuresRaw.ts`, the one legal home of `fetch` per
`stapel/no-raw-fetch`) and hands it back as `bag.effectiveFrom`:

```tsx
<CategoryFeatures categoryId={id}>
  {(bag) => /* bag.effectiveFrom: "own" | "children" */}
</CategoryFeatures>
```

A feature only some children carry, or one whose config, `mandatory` or rules
disagree between them, carries `divergent: true` — its `config` is already the
widest the children accept. Drawing it before a chip is picked offers a
control that means something different depending which chip gets chosen, so
`visibleFeatures` hides it until then:

```tsx
import { visibleFeatures } from "@stapel/categories-react";

const shown = visibleFeatures(bag.features, { chipPicked: partitionChild !== null });
```

`chipPicked: true` is a no-op — pass it once the person has picked a
partition child, and every row (divergent or not) shows. `partitionChild`
comes from the cascade: see the commit-rule section below.

## Surface

| Export | What it is |
|---|---|
| `createCategoriesRuntime` / `CategoriesProvider` | wiring |
| `useCategoryCatalog` | the delta-synced tree, one hook, mounted once |
| `useCategoryChildren` / `useCategoryCarousel` / `useCategoryFeatures` / `useCategoriesRevision` | the four direct reads |
| `useCategoryTree(depth = 3)` | the nested menu tree — one cached call, `GET /tree/?depth=N` |
| `browseStage(category)` | which page the category gets: `"tiles"` only for a root with children, `"feed"` otherwise |
| `childControl(category)` | the filter a feed page's own rail gets for this category's children: `"none"` \| `"segmented"` \| `"list"` |
| `buildCategoryTree` / `resolveCategorySlug` / `categoryBreadcrumbs` / `parseTreenodePks` | pure tree assembly |
| `applyCategoryPage` / `firstPageRequest` / `nextPageRequest` / `syncCatalog` | the delta protocol, testable without React |
| `categoryLabel` / `featureLabel` / `featureCommentLabel` / `renderCategoryLabel` | the translation-key answer |
| `<CategoryTree>` `<CategoryBreadcrumbs>` `<CategoryCarousel>` `<CategoryPicker>` `<CategoryFeatures>` | headless bags |
| `visibleFeatures(features, { chipPicked })` | hides a `divergent: true` row until a chip is picked |
| `useCategoryCascade` / `<CategoryCascade>` | the ladder of child selects the tile cap hands over to — one `children/` per rung, three commit rules |
| `/default`: `CatalogPage` `CategoryPage` `CategoryTreePane` `CategoryBreadcrumbsBar` `CategoryCarouselStrip` `CategoryTileGrid` `CategoryMegaMenu` `CategoryPickerField` `CategoryCascadeField` `CategoryFeatureList` | the antd skin |

Nav entries: `categories.catalog` → `/c`, `categories.category` → `/c/:slug`,
both `surface: "public"`. `/` is **not** claimed — the storefront's landing is
categories *plus* search, and a composed route belongs to the container that
composes it.

`<CategoryPage>` takes `renderListings` for the same reason: the results half of
`/c/:slug` belongs to another pair, handed in rather than imported across the
L2 layer. Leave it out and the page renders a NAMED placeholder in a
development build (`SlotPlaceholder`, `@stapel/core`) and nothing in
production — an unfilled composition slot that looks like a finished page is
the one defect nobody reports.

`<CatalogPage>` takes `renderIcon` and forwards it to the carousel. Carousel
icon references are opaque strings the backend refuses to resolve, so without
a resolver the tiles are text — by construction, not by accident, and never a
guessed CDN path that 404s on somebody else's deployment.

Theming is the shared substrate's: every surface wraps itself in `SkinTheme`
from `@stapel/tokens-antd/skin`, which reads the document's live `data-theme`,
paints its own background, and raises antd's `controlHeight` to 44px below the
tablet breakpoint. This package no longer exports a `CategoriesSkinTheme` or
its own `ErrorAlert` — import `SkinTheme` / `ErrorAlert` from
`@stapel/tokens-antd/skin` instead.

Below the tablet breakpoint `<CategoryPickerField>` is a trigger plus a bottom
sheet rather than an inline list: a drill-down is a journey, and a journey
rendered inline in a long compose form moves every field under it. Pass
`surface="inline" | "sheet"` to pin the shape for a host that is not the
viewport.

## Tiles are two levels: `browseStage` and `childControl`

**The stage answer changed** (2026-09-04, evening correction to the browse
contract): tiles are the home screen and a root's own page, full stop. Every
page below a root — no matter what its own children look like — is a FEED
over its whole subtree. `children_as` no longer decides the stage; it decides
the FILTER a feed page puts at the top of its rail.

```ts
browseStage(node)    // "tiles" | "feed"
// a ROOT with children → "tiles"   ·   everything else → "feed"

childControl(node)   // "none" | "segmented" | "list"
// childless → "none"
// children_as === "chips" → "segmented" (a single-select chip row — the
//   children are a PARTITION of one template, the same attribute set split by
//   a value their name expresses: new/used, buy/sell/rent, boys/girls)
// otherwise, with children → "list" (a single-select subcategory list with
//   counts — the drill-down the search answer already carries)
```

A `chips` row's children keep their ids, their paths and their URLs and stay
the placement target of a listing; only the presentation changes. Neither call
cares whether the row it is handed is a root or not by counting depth itself —
`browseStage` reads `tn_parent` / `tn_ancestors_pks` / a `CategoryTreeNode`'s
own `path` (whichever the row carries) to answer "is this a root", and both
calls read `tn_children_pks` before `children_as` before the nested `children`
array to answer "does it have any" — because a depth-capped tree read empties
the `children` array on its last level, and `children_as` survives that cut
where the array does not (the server sends it `null` **only** where a row
truly has nothing to present).

The superseded reading ("tiles end where the attribute schema begins", i.e.
`children_as: "tiles"` draws a grid at ANY depth) put tile pages six levels
deep on the imported tree, because schemas hang on the leaves. It is gone:
`browseStage` never looks at `children_as` at all.

The server sends the resolved `children_as`; `auto` is derived at import time
and never reaches the wire.

## A one-rung import wrapper is invisible: `isTransparentWrapper` / `browseChildren`

**Census addendum** to the browse-stages contract (2026-09-04): `/c/uslugi`
has one child (an import-only "offer" category) whose own children are the
real 34 groups — a level that exists only because the source catalogue
nested a real level under a placeholder one. Browsing skips it: a root's
tile page shows the wrapper's children directly, never a single tile
pointing at the wrapper.

```ts
isTransparentWrapper(children) // boolean
// true only for EXACTLY ONE child that itself has children — a leaf child,
// or two-or-more children, is never a wrapper

browseChildren(children, grandchildrenOf) // the rows a tile page should draw
// not a wrapper           → children, unchanged
// a wrapper, resolved      → grandchildrenOf(children[0])
// a wrapper, not resolved yet (grandchildrenOf returns undefined)
//                          → children — the ONE wrapper tile, until it lands
```

Both read the same fields `hasChildren`/`browseStage` already do — a flat
row's `tn_children_pks`, then `children_as` surviving a depth cut — so
detecting a wrapper never costs a request. Drawing its children does:
`grandchildrenOf` is the caller's accessor, `(child) => child.children` for a
nested `CategoryTreeNode`, or a small `useCategoryChildren` read gated on the
one candidate id for flat rows. `<CategoryPage subcategories="tiles">` wires
this itself (`TileSubcategories`); a host drawing its own tiles from
`useCategoryTree()` calls `browseChildren` the same way.

The rule fires **once**: a wrapper whose only child is itself a wrapper is
not chased further — the addendum names one substitution, not a walk to the
first branching descendant, and nothing on the imported tree has needed more
than one hop. `<CategoryCascadeField>` applies the same one-hop merge to
whichever rung a wrapper lands on, so a ladder never shows a one-option
"click to continue" select for an import level nobody may act on — the
wrapper's own children appear at that rung instead, fetched eagerly the
moment the wrapper is detected rather than only after a (pointless) click.

## The desktop mega-menu: one call, three levels

`useCategoryTree(depth)` is `GET /tree/?depth=N` — active nodes, ordered,
nested, with `id`, `slug`, `name`, `path`, `catalog_icon`, `children_as` and
`children` per node. One request, cached on the server against the tree's own
revision. The alternatives it replaces are one request per branch (roots plus
a `children` read each) or the whole catalogue table before the first name can
be drawn.

```tsx
<CategoryMegaMenu linkComponent={RouterLink} onClose={close} />
```

Roots on the left with their `catalog_icon`, the chosen root's second-level
headers on the right, five third-level links under each and `Ещё N` pointing
at the header when there are more. Hover, focus and the arrow keys all select
a root; `ArrowRight` steps into the pane and `ArrowLeft` comes back; Escape
and a click outside call `onClose` — the panel never hides itself, because a
closed panel and a trigger that still reads "open" are two answers to one
question.

`minWidth` (default 1024) is a **guard, not a policy**: the storefront decides
when to mount the panel, and below that width it renders nothing and asks for
nothing. A phone's door into the catalogue is the tile grid, with no drawer.

`node.path` is `"141/151/166"` — the exact form the search query's `category`
parameter takes, so a host that routes categories through its feed passes its
own `href` builder and hands the path straight over.

## Tiles draw `catalog_icon` when it is already an address

A tile's art has three arms, in this order, and **every one of them may
decline**: the host's `renderIcon` (a storefront with its own root glyphs keeps
them), then an address — `resolveIconSrc` if the host supplies one, else
`catalog_icon` when the row already carries a URL — and then the category's
initial as a monogram. The library still never BUILDS a URL out of an opaque
reference like `catalog/electronics`, which is what `categoryIconSrc` decides
and what keeps a broken image off every deployment that resolves its CDN
differently.

Declining is the part to know. `renderIcon` returning `null` means *not this
row*, not *no art anywhere*: a host with glyphs for its five roots hands back
`null` for the rest and the remaining arms answer them.

```tsx
<CategoryTileGrid
  // an opaque CDN ref (`product/<sha256>`) → a URL, without projecting rows
  resolveIconSrc={(category) => cdn.get(category.catalog_icon)}
/>
```

`resolveIconSrc` takes the CATEGORY, so a host keyed by row answers from its
own store instead of copying the catalogue into a new `entries` array per
render, and it keeps the library's `<img>` — lazy, 3:2, `contain`, alt text
from the tile's own label. What it returns still goes through
`categoryIconSrc`, so a resolver that hands back a reference or a `data:` URI
draws the monogram rather than a broken image. `undefined` declines.

## Tiles that wrap instead of scrolling

`layout="wrap"` is the same tiles with no scroll port: as many per line as the
container allows, wrapping onto as many lines as it takes, so nothing is off
screen. `minTileWidth` (default 240) is the narrowest a tile may be before the
grid drops a column — `repeat(auto-fill, minmax(min(240px, 100%), 1fr))`, and
the `min(…, 100%)` is what stops a container narrower than one tile from
scrolling sideways.

```tsx
<CategoryTileGrid layout="wrap" minTileWidth={160} />
```

The default is unchanged: `layout="scroll"`, the reference two-row sideways
row with the peeking third column. A wrapped grid is a different geometry
rather than a wider one, which is why it is a layout and not a breakpoint.

`<CategoryPage subcategoryLayout>` reaches the same switch from the `"tiles"`
arm, with `subcategoryMinTileWidth` alongside it: a category with a handful of
children (five, say, in a wide desktop column) reads as an empty corner under
the scroller and needs `"wrap"` to fill the row the way the reference design
does. Both default unchanged, so no existing host changes shape.

```tsx
<CategoryPage
  categoryId={id}
  subcategories="tiles"
  subcategoryLayout="wrap"
  subcategoryMinTileWidth={280}
/>
```

## The first row does not wait for a scrollbar: `eagerCount`

Every tile image used to be `loading="lazy"`, including a whole first row that
is above the fold on the day it renders — the browser is never told any of
them are urgent, so the row's real height (and everything a page stacks below
it) can settle a frame late. `eagerCount` (default 8) marks that many of the
LEADING tiles `loading="eager"` with `fetchPriority="high"`; the "All" tile
never counts against it, because it never carries a picture. Every tile past
the count stays `loading="lazy"`, which still matters for a `layout="wrap"`
landing or a mega-menu drawing dozens of these below the fold.

```tsx
<CategoryTileGrid eagerCount={5} />
```

The art corner itself reserves its shape independently of `eagerCount`: the
box around a tile's picture (or its monogram, when there is no picture) is a
fixed percentage of the tile at a fixed aspect ratio, so a tile's own height —
already fixed by its 4:3 aspect ratio against a definite grid column — never
grows or shrinks as an image decodes. A `layout="wrap"` row's height is the
grid's own arithmetic from the start, with nothing in it waiting on an asset.

## The cascade's commit rule: `any`, `leaf`, `stage`

`useCategoryCascade` / `<CategoryCascadeField>` is the ladder of child selects
the tile cap hands over to — one small `GET {id}/children/` per rung, never the
catalogue. `commit` says what it reports to its host:

| `commit` | reports | for |
|---|---|---|
| `"any"` (default) | every choice, leaf or not | the FILTER — "everything under Cars" is a prefix match the index already answers |
| `"leaf"` | only a category nothing lives under | the composer, as the TREE alone states it |
| `"stage"` | the category `childControl` would put no LIST filter under — `childControl(node) !== "list"`, i.e. a leaf (`"none"`) **or** a `chips` parent (`"segmented"`) | the composer, as the BROWSE CONTRACT states it |

The difference between the last two is a partition. Under `"leaf"` a `chips`
parent (`Cars`, with `New` and `Used` under it) is refused and the cascade goes
on offering a rung of `New` / `Used` — which presents a FILTER as a level of
the tree, and the browsing half and the posting half of the site then disagree
about what a category is. Under `"stage"` the cascade commits `Cars` and stops:
it offers no rung below a `chips` parent and fires no request for one. The
partition child is then a required select the host draws beside the cascade,
out of the same rows, where it reads as the choice it is.

The intermediate steps still show as answered in every mode — they are the
cursor, not a value. `blockedReason` says why no value came back:
`"nothing_selected"`, `"not_a_leaf"` (the `"leaf"` refusal) or
`"has_subcategories"` (the `"stage"` one). Keyboard and aria are the same
control in all three.

The partition child itself is the host's own select, drawn beside the cascade
out of the stopped category's own children — the cascade never fetches or
chooses it. Pass the host's current pick as `partitionChild` and the bag
echoes it straight back, so one bag (not two pieces of state kept in step by
hand) tells the rest of the screen whether a chip is picked:

```tsx
const { partitionChild, ...cascade } = useCategoryCascade({ commit: "stage", partitionChild: chip });
const shown = visibleFeatures(features, { chipPicked: partitionChild !== null });
```

## The mega-menu's `onSelect`

`<CategoryMegaMenu onSelect={(node, kind) => …}>` fires on click (and on
Enter — a link and the rail's own buttons both dispatch a native `click` for
that) of any item in the panel: `kind` is `"root"` for a rail entry, `"child"`
for a column's own header link (the tail `N more` link included — it leads to
the same node), and `"grandchild"` for one of its third-level links. It is
additive: the row still navigates through `href` / `linkComponent` exactly as
before, and closing the panel is still the host's job (`onClose`). Before this
the only way to learn which row was pressed was reading `data-category-id`
back off the DOM through a delegated listener.

## The category page's title: `heading`

`<CategoryPage>` renders the category's own translated name as its heading.
`heading` replaces that CONTENT — a node, or a function of
`{ category, count }` — and never the heading element, so a storefront that
needs «Купить автомобиль в Сочи · 54 364» gets it without drawing a second
title above the page's and leaving two headings in one outline.

```tsx
<CategoryPage
  slug={slug}
  // `resultCount` is the host's own state — the listings pair counted it
  heading={({ category }) => <>{t(`buy.${category.slug}`)} · {resultCount}</>}
/>
```

`count` is the number of SUB-CATEGORIES the page has in hand — the only count
this pair owns. A results count belongs to the listings pair and is already in
the host's state, which is why the slot takes a node rather than a template.

The page's content column defaults to `CATEGORY_MEASURE` (`64rem`) wide; pass
`measure` (anything CSS `max-width` takes — `"72rem"`, `960`, `"100%"`) for a
host that wants a different one, instead of overriding it from outside with
`!important` against a value it could not read back.

## Category chrome inside a SPA: `linkComponent`

Breadcrumbs, the tree and the carousel are nothing but links, and by default
they are anchors — which in a router app means a full page load per click: the
whole application thrown away and rebuilt to move between two categories whose
rows are already in memory, which is the entire point of the delta-synced
catalogue above.

This pair still carries no router (there are several, and a library that picks
one picks it for every host). It takes core's `LinkComponent` instead — a
component over a plain `href` — and every skin here spells the prop the same:

```tsx
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>{children}</Link>
);

<CatalogPage linkComponent={RouterLink} />
<CategoryPage slug={slug} linkComponent={RouterLink} renderListings={…} />
<CategoryTreePane linkComponent={RouterLink} />
<CategoryBreadcrumbsBar slug={slug} linkComponent={RouterLink} />
<CategoryCarouselStrip linkComponent={RouterLink} />
```

`<CatalogPage>` and `<CategoryPage>` pass it down to everything they compose.
Omit it and anchors render exactly as before: a host with no router keeps
working, and it is the same prop `@stapel/listings-react`'s `<ListingCard>`
takes.

## Registering the locales

```tsx
import { registerCategoriesI18nRu } from "@stapel/categories-react/i18n/ru";
import { registerAttributesI18nRu } from "@stapel/attributes-react/i18n/ru";

registerCategoriesI18nRu(i18n);
registerAttributesI18nRu(i18n);   // ← not optional if you render features
```

**A ru/es host must register `@stapel/attributes-react/i18n/{ru,es}` as well.**
`stapel-categories` embeds `stapel_attributes`, which owns twelve of the
sixty-two error codes in the registry (`error.400.feature_below_minimum`,
`…feature_mandatory_missing`, `…description_too_long`, …) and ships no
`translations/` directory upstream, so those sentences live in the pair that
draws and validates those values. This package deliberately does **not** carry
them: two pairs giving one refusal two sentences is exactly what that rule
exists to prevent. Skip the attributes bundle and twelve feature-validation
refusals render in English in the middle of a translated form.
`test/i18n.test.ts` asserts over the union of the two bundles, not over this
one, so the arrangement cannot silently rot.

## Not in this version

The catalogue **admin** — create/update/delete, `bulk_add`, `bulk-commands`,
`undelete`, `convert-type` and the four feature-editor operations — is not on
this pair's surface. Every one of them is `IsStaffUser`, and the storefront
wave leaves them to Django admin. `POST {id}/validate-dto/` is absent for the
same reason: DRF treats it as a write, so it answers 403 to exactly the
visitors who would want it; the compose form uses attributes-react's
client-side mirror plus the server's verdict on publish. `GET
/translation-keys/` is `IsServiceRequest`. `GET /data.json` is a second sync
protocol and one tested protocol beats two half-tested ones.

Nothing is hidden: `manifest.json` lists the whole contract.

## More

- [`MODULE.md`](./MODULE.md) — the module guide: layers, and every contract
  note recorded rather than worked around.
- [`llms.txt`](./llms.txt) — the generated surface slice for a coding harness.
- [`manifest.json`](./manifest.json) — the machine-readable self-description.
