---
"@stapel/categories-react": minor
---

The catalogue screens become the product: the skin is photographed, the two
composition seams the `/c` routes ship are reachable, and the upstream
discriminator fix is climbed.

**Breaking (pre-1.0 ⇒ minor).** `CategoriesSkinTheme`, `CategoriesSkinThemeProps`
and the pair's own `ErrorAlert` are gone from `@stapel/categories-react/default`.
Every surface now wraps itself in `SkinTheme` from `@stapel/tokens-antd/skin` —
which reads the document's LIVE `data-theme` instead of sampling it once, paints
its own surface, and raises antd's `controlHeight` to 44px below the tablet
breakpoint. A host that wrapped a composition of these parts imports `SkinTheme`
(and `ErrorAlert`) from `@stapel/tokens-antd/skin`.

**The contract chain, climbed.** `src/api/generated/schema.ts` is regenerated
against stapel-categories 0.6.1: the `FeatureConfig` discriminator this pair
FILED as a defect is fixed upstream (stapel-attributes 0.4.7), so the ten
members now carry their real slugs (`type: "bool"`, not `type: "BoolConfig"`).
The thirty-line apologia in `src/api/types.ts` is deleted and replaced by two
derived types — `CategoryFeatureConfig` (the slug-keyed union, narrowable) and
`CategoryFeatureType` — pinned in both directions by `test/contract.test.ts`.

**Composition seams.**
- `CatalogPage` accepts and forwards `renderIcon`, so the `/c` route can draw a
  category icon at all; it could not before, whatever the host did.
- `CategoryPage`'s unfilled `renderListings` renders `<SlotPlaceholder
  name="renderListings">` (named in dev, nothing in production) instead of
  silence in the exact place every listing belongs.

**Phone.** `CategoryPickerField` is a trigger plus a bottom sheet (`SkinDialog`)
below the tablet breakpoint and the inline list above it; `surface="sheet" |
"inline"` pins the shape.

**Also:** a feature's `comment` — the catalogue author's note to the person
filling the form, previously read by nothing in the fleet — renders under the
feature name via the new `featureCommentLabel`; the sub-category count is a
translated plural sentence instead of a hover `title=`; `createCatalogStore`
takes `onUnpersisted` and warns once instead of silently falling back to an
in-memory catalogue; every load/empty/error arm goes through the substrate's
`LoadList` / `LoadBoundary` / `EmptyState` / `ErrorAlert`.

**Demos.** All seven demos now render `src/default` — the antd skin had never
been drawn in a story, including both nav-mounted screens. 7 demos / 30
variants, every one seeded into the query cache so its static render IS the
state it is named for, each with a declared `step`, at least one `phone`
variant per component, and `assertVariantsRenderDistinctly` in the suite.
`demo/_harness.tsx`'s `DemoCard` / `StepBadge` debug chrome is deleted.

New keys (en/ru/es): `categories.category.unknown_slug_hint`,
`categories.category.subcategories_count.*` (plural family),
`categories.picker.choose`, `categories.picker.done`. New exports:
`CATEGORIES_I18N_PLURAL_KEYS`, `featureCommentLabel`, `UNPERSISTED_WARNING`,
`CategoryFeatureConfig`, `CategoryFeatureType`.
