---
"@stapel/listings-react": minor
---

listings: the heart reports its own outcome, a gated heart discloses on the gesture, and an already-seen card is dimmed

Three defects measured on a live deployment, and one new axis built against a contract that is landing upstream.

**The heart gave no feedback.** A signed-in person tapped it and nothing moved: the write went out and the invalidation landed, but the row a card draws from is a prop owned by a list query further up, so the icon kept showing the state from before the tap until that query refetched. `useFavoriteToggle` and `useListingDetail` now predict the next state on the gesture, replace the prediction with the server's own `favorited` when the write lands, and roll it back when the write fails — with the failure stated through the pair's existing `ErrorAlert` rather than left silent. The prediction is tagged with the listing id, because a virtualised grid reuses a hook instance across rows. Saved now draws as a filled accent heart and unsaved as an outline, on the cards and on the listing page.

`is_favorited: null` — "nobody asked on this person's behalf", which is what every anonymous read sends — renders as the not-favorited outline and never as a third look, while staying distinguishable underneath: `FavoriteToggleBag.known` and `ListingDetailBag.favoriteKnown` are what a caller asks before treating the row as authoritative. `ListingDetailBag.isFavorited` is now `boolean` rather than `boolean | undefined`.

The wire carries `is_favorited` and no favourite COUNT, so none is drawn. A test asserts that against the generated schema, so the day one lands, rendering it is a decision rather than an invention.

**An anonymous person's heart was a dead button.** Two causes wearing one symptom. The favourite control is no longer html-`disabled` in any volume on any surface: it carries `aria-disabled` with a live handler and refuses on activation, because an inert button takes no focus, receives no pointer events, and can explain itself to nobody. And `GateReasonPopover` is now a controlled disclosure whose activation is monotonic — an uncontrolled popover triggered by hover and click treated the click as a toggle, so a pointer that rested on the heart and then pressed it closed the only explanation the control had. The existing tests never caught it because a synthetic `click` carries no hover in front of it.

`<ListingFeedCard>` was the last surface still printing the standing "sign in" caption over its photograph; it now takes `signIn` and `blockedReason` and defaults to the interaction disclosure, since a two-column tile has no line to put a sentence on. A host that wants the standing sentence asks for it with `blockedReason="text"`.

**A viewed state.** The engagement fields are read defensively through `model/engagement.ts` (`isListingViewed`, `listingViewCount`) and declared as optional `ListingEngagementFields` beside the generated schema, which is emitted and not ours to edit. All three cards dim an already-seen listing through one rule in the stylesheet they already share — opacity, so it needs no second colour for dark mode — and the listing page prints the view count when there is one. The fields are absent from every response today and the whole feature is a silent no-op when they are: no dimming, no count, no console noise, no layout shift.

The already-seen flag is read under BOTH spellings, `is_viewed` and `viewed`. The contract note this was built against uses the first and stapel-listings' emitted schema uses the second; neither has shipped, and a pair that bet on one name would render nothing at all for the other with no error anywhere, because an absent key is `undefined` and `undefined` correctly means "do not dim". One `??` buys a feature that works whichever name lands; when it settles, the loser is deleted in one place.

The skin bundle budget moves 20 → 21 KB (measured 20.22); the argument is in `package.json`.
