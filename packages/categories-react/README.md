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

## Surface

| Export | What it is |
|---|---|
| `createCategoriesRuntime` / `CategoriesProvider` | wiring |
| `useCategoryCatalog` | the delta-synced tree, one hook, mounted once |
| `useCategoryChildren` / `useCategoryCarousel` / `useCategoryFeatures` / `useCategoriesRevision` | the four direct reads |
| `buildCategoryTree` / `resolveCategorySlug` / `categoryBreadcrumbs` / `parseTreenodePks` | pure tree assembly |
| `applyCategoryPage` / `firstPageRequest` / `nextPageRequest` / `syncCatalog` | the delta protocol, testable without React |
| `categoryLabel` / `featureLabel` / `renderCategoryLabel` | the translation-key answer |
| `<CategoryTree>` `<CategoryBreadcrumbs>` `<CategoryCarousel>` `<CategoryPicker>` `<CategoryFeatures>` | headless bags |
| `/default`: `CatalogPage` `CategoryPage` `CategoryTreePane` `CategoryBreadcrumbsBar` `CategoryCarouselStrip` `CategoryPickerField` `CategoryFeatureList` | the antd skin |

Nav entries: `categories.catalog` → `/c`, `categories.category` → `/c/:slug`,
both `surface: "public"`. `/` is **not** claimed — the storefront's landing is
categories *plus* search, and a composed route belongs to the container that
composes it.

`<CategoryPage>` takes `renderListings` for the same reason: the results half of
`/c/:slug` belongs to another pair, handed in rather than imported across the
L2 layer.

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
