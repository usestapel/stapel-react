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
`hrefFor` receives the row itself as a second argument — `(id, row) =>
\`/l/${id}-${slugify(row.title)}\`` — for a host whose routes carry a slug and
would otherwise have no way to build one from an id alone; `(id) => ...`
still works unchanged for a host that does not need it.

### The heart a visitor can see, read, and act on

```tsx
<ListingCard listing={row} href={`/l/${row.id}`} signIn={{ href: `/login?next=${here}` }} />
```

The favourite control is never hidden from a visitor — it is switched off, the
reason is printed as TEXT beside it (a tooltip on a disabled button is a reason
nobody can read), and `signIn` is the door. `SignInCta` is core's, `{href}`
**or** `{onSignIn}`, the same prop `@stapel/chat-react` and
`@stapel/reviews-react` take. Omit it and the reason renders alone.

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

**The row comes before the category.** The first save creates the draft whether
or not a category has been chosen — `category_id` is nullable on the draft half
(stapel-listings 0.21.4) and the create body is simply `{}` — so anything
addressed BY the draft id (a background analysis, an upload filed against it, a
link back into an unfinished submission) has an id to be addressed by from the
first save on. The category is a field written by whichever save follows the
pick, and it is mandatory only to PUBLISH, which is where the gate and the
server's own `publish_validation_failed` both keep it. `bag.stage ===
"choosing_category"` therefore says nothing about whether the row exists; read
`bag.listingId` for that.

**Reopening a listing reads the draft twin.** `listingId` seeds the form from
`GET /{pk}/draft/` (stapel-listings 0.21.1) — what was actually last typed,
published or not — and falls back to the published half only when that read
404s: nothing was ever saved into it, or the backend predates the route. A
build on an older backend keeps working exactly as it did before.

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

## A card's photos answer a hover and a swipe

A card with six photographs used to show one, and the other five needed a
navigation. `<ListingPhotoStrip>` — the one gallery `<ListingCard>` and
`<ListingSerpCard>` both draw — now adds the two gestures a classified is
expected to have:

- **hover scrub.** The media box is divided into as many equal segments as
  there are photographs; the segment the cursor is over is the photograph on
  screen, and the pointer leaving puts the first one back. Gated on
  `(hover: hover) and (pointer: fine)` **and** on a `mouse` pointer type — a
  touch laptop answers the media query and still delivers finger events.
- **swipe.** A horizontal drag past 32px, and further across than down,
  advances or rewinds one photograph. The strip declares `touch-action:
  pan-y`, so the page's vertical scroll belongs to the browser and no handler
  can take it; a diagonal thumb scrolling a feed changes no photograph.

Neither gesture replaces the strip: both work by scrolling the same
`<SkinCarousel>`, so it stays a focusable scroll container the arrow keys
move, the slides stay in the document for a screen reader, the dots keep
reporting the position — and the card stays ONE link with one accessible
name, the heart outside it.

## Characteristics read as sentences, with units

The listing page's spec list is `<ListingSpecList>` (`<ListingSpecColumns>`
for the two-column arm of `layout="split"`), and a row is a paragraph: a
muted inline label, then the value in the same text flow. It was a two-column
table, where a long answer wrapped inside a narrow value cell and stacked
under itself. The split layout still puts two columns side by side — but they
are columns of whole ROWS, cut by row count so the category's declaration
order reads top-to-bottom, left column first.

Values are typeset rather than stringified: the unit is appended and the
digits are grouped by the reader's locale, so a mileage reads `20 000 km` and
not `20000`, and an engine volume reads `2,0 l` in Russian. **There is no
`unit` key on a feature definition anywhere in this fleet** — the unit of an
`int`/`float` IS its `postfix` — so `formatSpecValue` reads that, from the
stored row first and from `categoryFeatures` second. The second rung is what
repairs a listing published before its category declared a unit; where
nothing declares one, the bare number stands. No unit is invented.

Grouping follows the unit, because a number without one is usually not a
quantity: a year printed as `2 024` is the wrong reading, and so is a floor or
a count of doors. A value is grouped when its feature carries a unit
(`prefix`/`postfix`/`postfix1000`) or when it is at least 10 000 — a threshold
no year or room count reaches, which is why no "does this slug look like a
year" heuristic is needed. A unitless float still gets the reader's decimal
mark; only the separator is switched off.

## Card badges say what they mean

`features_badges` used to print its values and nothing else: a live card read
`Brick · 3 · 9`. stapel-listings 0.21.3 adds `label`, `unit`, `name` and
`presentation` to each element, and `presentation` is the server's decision —
`value`, `value_unit`, `name_value` or `name` (the last for a true boolean,
whose name IS the badge; a false one prints nothing). All three card surfaces
render it through one function, `cardBadgeText`.

An element that declares no `presentation` comes from a server older than
0.21.3, and the whole projection then renders exactly as it did before —
through `@stapel/attributes-react`'s `<FeatureBadges>`, off the stored DAO's
own config. Nothing about the contract is required for a card to draw.

## The seller's dashboard

**Your own listings, in every status.** `GET my/listings/` (stapel-listings
0.7.0) is the owner-scoped read `GET /listings/` cannot be: `list` answers
`published()` and takes no owner parameter, so before 0.7.0 a seller's own
drafts were unreachable by any call the contract offered and this pane named
the absence instead of drawing an empty grid. Three tabs, each narrowed with
`?status=` to the SERVER's own groupings, so a tab's rows and its
`my/counters` badge always describe the same set. `MyListingsSource` is still
a seam for a deployment that keeps its rows elsewhere.

**The takedown is not in a tab.** `blocked` is counted by `my/counters` in no
tab at all, so folding it into one would make a badge and its rows disagree,
and leaving it out would hide the one listing whose owner most needs to know.
It is fetched beside the tabs and rendered above them.

**A draft renders off its twin.** `title` / `price` / `images` are the
PUBLISHED fields and are empty until a publish promotes them, so the owner
card carries `title_draft` / `price_draft` / `images_draft` too and
`model/mine.ts` holds the one rule: the published value when there is one, the
draft otherwise — and the row says which it is showing.

**A row links to its own page.** `listingHref` builds it: `(id) =>
\`/l/${id}\`` for a storefront that only needs the id, or `(id, row) =>
\`/l/${id}-${slugify(row.title)}\`` for one whose routes carry a slug — `row`
is the same `MyListingCard` the row renders from, `title` guaranteed present
(a never-submitted row draws no link at all, so `listingHref` is never called
for one). Absent, the title and thumbnail stay plain text and a picture.

## What this pair cannot do, and why

**Write through `PUT` / `PATCH`.** They are on the contract and absent from
`ListingsApi`. That began as a safety decision — until 0.6.2 both were the
plain `ModelViewSet` writes under `IsAuthenticatedOrReadOnly` over
`Listing.objects.all()`, so any authenticated caller could write any listing's
draft fields. 0.6.2 put `views._get_own` in front of both; the absence is now
a plain scope decision, because `POST /{pk}/save-draft/` performs the same
write and one write path is enough.

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
