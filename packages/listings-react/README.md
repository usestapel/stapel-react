# @stapel/listings-react

The frontend pair for **stapel-listings**: the listing page, the submission
flow, and the seller's dashboard.

Two facts about this module shape the whole package, and both are easy to get
subtly wrong:

1. **A listing has two independent state axes.** `status` decides whether
   anyone can see it; `moderation_status` decides nothing about that. Since
   stapel-listings 0.5.0 an edit to a LIVE listing keeps `status: published`
   and moves only the moderation axis — so "published, and we are reviewing
   your changes" is a real state, and a screen that computed either field from
   the other would either hide a listing buyers are reading or never tell its
   owner their edit is being screened.
2. **A publish refusal is per-field, and it arrives in an unusual envelope.**
   `POST /{pk}/publish/` answers an invalid draft with a bare
   `ValidationBatchResult` — no `localizable_error` — while a promotion that
   fails afterwards answers the ordinary one. Two 400s, two meanings.

Business + state in the main entry, zero visual opinion; the antd skin lives
behind `./default`. Built on `@stapel/core` (typed client + `StapelApiError`
envelope, `LoadState`, `ActionAvailability`, the mandate seam, i18n engine,
TanStack Query), `@stapel/attributes-react` (the value editors, the client
mirror and the display formatter) and `@stapel/image` (the variant ladder).

## Install

```
pnpm add @stapel/listings-react @stapel/core @stapel/attributes-react @stapel/image @tanstack/react-query react
# for the default skin:
pnpm add antd @stapel/tokens-antd
```

## A listing page, in six lines

```tsx
import { createListingsRuntime, ListingsProvider } from "@stapel/listings-react";
import { ListingDetailPane } from "@stapel/listings-react/default";

const runtime = createListingsRuntime({
  baseUrl: "/listings/api/v1/",
  resolveImage: (ref) => myCdn.describe(ref), // see "Photos" below
});

export function ListingRoute({ id }: { id: number }) {
  return (
    <ListingsProvider runtime={runtime}>
      <ListingDetailPane id={id} />
    </ListingsProvider>
  );
}
```

## The card is a slot, not an import

A marketplace's result grid goes through `@stapel/search-react`, because
`promoted` (DSA Art. 26) rides every search item under every sort and a card
list that carried the marking on some pages and not others would be worse than
one that never claimed it. The two pairs never import each other — the
container is the seam:

```tsx
<SearchPage renderCard={(item) => <ListingCard listing={item.card} href={`/l/${item.id}`} />} />
```

`<ListingCard>` renders its badges from `features_badges`, a stored projection
that carries each type's display config beside its value. A grid of forty
cards therefore costs one query and **no category read**.

### How a card opens: one of three, never two

```tsx
<ListingCard listing={row} href={`/l/${row.id}`} />                       // an anchor
<ListingCard listing={row} href={`/l/${row.id}`} linkComponent={Link} />  // the host's <Link>
<ListingCard listing={row} onOpen={(id) => navigate(`/l/${id}`)} />       // a button
<ListingCard listing={row} />                                            // no open control
```

`href` and `onOpen` are arms of a union, not two optional props, because a card
that had both navigated **twice** for one click — the handler ran and the
browser then followed the anchor. Passing both is now a type error.

`linkComponent` is `@stapel/core`'s `LinkComponent`: a component taking a plain
`href`, so the pair stays router-agnostic and a container keeps a real anchor
(middle-click, "open in new tab", a crawler) while the click stays inside the
SPA:

```tsx
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>{children}</Link>
);
```

`<FavoritesPane>` takes the same union (`hrefFor` / `onOpen` / `linkComponent`),
so a pane cannot re-introduce upstream what the card no longer allows.

## Submitting a listing

Four contracts meet on the composer, and three of them arrive as seams rather
than dependencies:

| what | how it arrives | why |
|---|---|---|
| the category's schema | `features: FeatureDef[]` | `@stapel/categories-react` is an L2 pair; L2 pairs do not import each other |
| the photos | `images` — two members of `@stapel/cdn-react`'s upload bag | same rule; `bag.refs` IS `images_draft` and `bag.settled` is the submit gate |
| the value editors | `@stapel/attributes-react` | L0, so a direct dependency |

```tsx
const [categoryId, setCategoryId] = useState<number | null>(null);
const gallery = useUploadQueue({ max: 10 });        // @stapel/cdn-react
const features = useCategoryFeatures(categoryId);   // @stapel/categories-react

<ListingComposerPage
  features={features.data ?? []}
  featuresLoading={features.isPending}
  featuresError={features.error ?? undefined}
  images={gallery}
  category={categoryId === null ? "" : String(categoryId)}
  onCategoryChange={(id) => setCategoryId(id === "" ? null : Number(id))}
  renderCategoryPicker={({ value, setCategory }) => (
    <CategoryPickerField
      value={value === "" ? null : Number(value)}
      onChange={(id) => setCategory(id === null ? "" : String(id))}
    />
  )}
  gallerySlot={<MediaGalleryField bag={gallery} />}
/>
```

The category is a **render prop**, not a node, because the composer's category
moves only through `setCategory` — a node rendered into a slot cannot reach it,
and a picker that cannot report what was chosen means `features` (the whole
point of the slot) is never read. `category` / `onCategoryChange` are there
because the container holds the id anyway: `useCategoryFeatures(id)` is keyed
by it.

The gallery is a node, but the BAG is the same object the composer got — that
is what makes `bag.refs` the value of `images_draft` and `bag.settled` the
publish gate. Two queues means the gate talks about photos it cannot see.

The schema arrives as three props, not one, so an empty list is never mistaken
for "this category asks nothing": `featuresLoading` and `featuresError` each
block the publish with their own sentence, and only a settled, empty schema
prints "no extra details for this category".

The flow is `create draft → save into it → publish`. The composer always saves
before it publishes, because `publish` promotes the STORED draft: publishing
without saving would promote whatever was there before the last keystroke.

### Every switched-off publish button says which of six reasons it is

sign in · choose a category · we could not load what this category asks for ·
this build cannot draw one of these details · wait for the photos · fix the
highlighted fields. They are ordered the way a person would be told, and the
reason is rendered beside the button.

## Photos need a resolver, and the pair says so

`Listing.images` is a list of opaque CDN references (`<type>/<hash>`), and
**no contract in this fleet resolves a stranger's reference**: there is no
public read-by-reference in stapel-listings, and stapel-cdn's `file/exists/`
is owner-scoped. So the runtime takes a `resolveImage` from the deployment,
which knows where its CDN serves from, and a pane without one says "photos
cannot be shown here" instead of drawing a broken `<img>`. Inventing
`${cdnBase}/${ref}` would be writing a contract nobody agreed to.

## What this pair cannot do, and why

**List your own listings.** stapel-listings 0.6.1 has no owner-scoped list
endpoint: `GET /listings/` answers `published()` and takes no owner parameter.
The counters (`my/counters`) are real and are shown; the rows come from an
injected `MyListingsSource`, and with none the dashboard reports a NAMED
failure rather than an empty grid — "we cannot ask" and "you have no listings"
are different sentences. See `src/model/mineSource.ts` for the upstream asks.

**Reopen an abandoned draft.** No read returns the `*_draft` twin:
`GET /{pk}/` serializes the published fields. Editing a LIVE listing works
completely (the published half IS the listing); a draft reopened in a later
session comes back empty and the composer says so.

**Write through `PUT` / `PATCH`.** They are on the contract and absent from
`ListingsApi`. Every other owner operation routes through `views._get_own`;
these two are the plain `ModelViewSet` implementations under
`IsAuthenticatedOrReadOnly` over `Listing.objects.all()`, so any authenticated
caller can write any listing's draft fields through them.
`POST /{pk}/save-draft/` performs the same write WITH the ownership check, so
the pair uses that and nothing is lost.

## Layers

```
src/api/       listingsApi.ts · types.ts · generated/schema.ts
src/model/     status · transitions · draft · features · validation · mineSource
               runtime · context · queryKeys · queries · mutations
src/flows/     registry.ts (zero-flow shim — the module annotates none)
src/headless/  ListingsProvider · ListingDetail · ListingComposer · MyListings
               Favorites · ListingActions · useMandateGate
src/default/   the antd skin, `./default` subpath
src/i18n/      keys · ru · es · errorsMap + generated/
src/nav/       manifest.ts
```

`model/` is pure apart from the hooks: the status table, the draft
conversions, the mirror and the publish-400 split are all plain functions, so
the parts worth getting right are tested without a DOM.

## Locales

English is inline. `./i18n/ru` and `./i18n/es` are opt-in subpaths and carry
the UI copy as well as the nine `stapel_listings` error keys — the storefront
is ru-first (owner verdict F1), and a half-translated submission form is
visible immediately. The twelve `stapel_attributes` keys are deliberately NOT
here: `@stapel/attributes-react` owns and translates them, and one refusal must
not have two sentences.

## Documentation

- `MODULE.md` — the module guide: the two axes in full, the contract deltas,
  the upstream asks.
- `manifest.json` / `llms.txt` — generated self-description, drift-gated.
- `nav-manifest.json` — the four routes this pair contributes.
