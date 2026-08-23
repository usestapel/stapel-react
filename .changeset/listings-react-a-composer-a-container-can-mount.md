---
"@stapel/listings-react": minor
---

The composer's category seam runs in both directions, so `/new` can be mounted

A seam that only goes one way is not a seam. `ListingComposerPage.categorySlot`
was a `ReactNode`, and the composer's category moves only through
`bag.setCategory` — which a node handed in from outside cannot reach. There was
no `onCategoryChange` either, so a container could neither set the category nor
learn it, and `features` — the schema OF the chosen category, the entire reason
the slot exists — was unreachable rather than withheld. The screen rendered and
could not be used; the storefront named it a gap instead of shipping it (Wave
D, G-1).

Two ways in, and `categorySlot` keeps rendering (deprecated, nothing breaks):

```tsx
<ListingComposerPage
  category={categoryId === null ? "" : String(categoryId)}
  onCategoryChange={(id) => setCategoryId(id === "" ? null : Number(id))}
  renderCategoryPicker={({ value, setCategory }) => (
    <CategoryPickerField
      value={value === "" ? null : Number(value)}
      onChange={(id) => setCategory(id === null ? "" : String(id))}
    />
  )}
  features={features.data ?? []}
  featuresLoading={features.isPending}
  featuresError={features.error ?? undefined}
/>
```

`renderCategoryPicker({ value, setCategory })` is the render-prop shape
`<CategoryPage renderListings>` already uses in the sibling pair. `category` /
`onCategoryChange` make the hook controlled on that one field, for the
container that holds the id anyway — it must, because
`useCategoryFeatures(id)` is keyed by it. `onCategoryChange` fires either way:
it is the wire the schema read is asked for on.

`useListingComposer` takes the same two options, so a host with its own skin
gets the same seam.

The README's example is now the wiring that works, and
`test/composerCategorySeam.test.tsx` gates it against the props declaration —
this pair documented `<MediaGalleryField bag={…}>` for a whole release while
the package had no such prop, and nothing in the suite could tell.
