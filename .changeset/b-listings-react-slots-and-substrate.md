---
"@stapel/listings-react": minor
---

The composer stops improvising controls nobody can use, the detail page gets a primary action, and the skin moves onto the shared substrate.

**Contract (stapel-listings 0.7.1).** `geohash_draft` is server-computed and `readOnly`: `Listing.save()` stamps it from `lat_draft`/`lon_draft` through `geo.geohash_encode`, and a value sent in the body is discarded. `schema.ts` regenerated, `draftPatchFromValues` no longer sends the field, and the two doc comments that asserted the opposite (`model/draft.ts`, `ListingComposerPage`) now state the contract.

**Four named slots, no invented controls.** `renderCategoryPicker`, the new `renderCurrencyPicker`, the new `locationPicker` (`{ value: {lat, lon, address?}, onChange }` — the shape `@stapel/geo-react`'s `<LocationPickerField>` fills, adapter documented on the type) and `gallerySlot` each render `<SlotPlaceholder name=…/>` when unfilled. Gone with them: the text box asking for a numeric category id, the text box asking for a currency code, the two decimal boxes labelled Latitude and Longitude, and the "Photos" heading over nothing. `renderLocationPicker` stays for a picker that also resolves `location_id`. `categorySlot` (deprecated: a node cannot reach `setCategory`) is removed.

**A primary action on the money screen.** `contactSlot` is the buyer's ("message the seller", from the container's chat pair); the OWNER gets Edit and Take down instead and no longer sees "save to favourites" on their own listing. `onEdit` is a real prop on both the detail pane and the dashboard, and its absence is a *gate*: the Edit button that was permanently enabled and inert now states that this app has no editing screen.

**Delete asks first** — `<SkinConfirm>`, one per list, a bottom sheet on a phone. It used to fire on the first click.

**Shared substrate.** `src/default/theme.tsx` and `src/default/ErrorAlert.tsx` are deleted; every surface wraps in `<SkinTheme>` (reactive `data-theme`, 44px controls on a phone) and errors/empties/gates come from `@stapel/tokens-antd/skin`. **Breaking:** `ListingsSkinTheme` and `ErrorAlert` are no longer exported from `/default` — import `SkinTheme` / `ErrorAlert` from `@stapel/tokens-antd/skin`. `ListingCardBlockedReason` loses its `"tooltip"` arm: a disabled antd button never fires the events a tooltip needs, so that setting hid the reason rather than quietening it.

**Phone geometry.** The dashboard row is a thumbnail plus a `min-width: 0` column whose four actions wrap instead of clipping at 390px (and no longer split "Draft" mid-word); status has one treatment — a tag carrying the tone with the moderation sentence beneath it, not three kinds of full-bleed bar; galleries and grids are element-relative (`auto-fit`/`auto-fill`) instead of `width: 320`/`240`; forms and pages carry a measure.

**Smaller things.** A visitor's favourites page shows one state with a sign-in door instead of a blocked notice over a spinner; pagers render only when there is a page to go to; the media placeholder is a themed aspect-ratio box with a camera glyph, not a `#d9d9d9` slab; `language` is seeded from the UI locale; `saveSoon()` makes a picker's "choosing IS the commit" save carry the value it just wrote; stored `select` values resolve through the host catalogue instead of printing `demo.condition.used` at people; and `registerListingsI18nRu/Es` now also register `@stapel/attributes-react`'s bundle, so the twelve refusals this pair deliberately does not author are no longer English on a translated page.

Ten default-skin components, six demos, every one with a phone variant and seeded steps.
