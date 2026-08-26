---
"@stapel/geo-react": minor
---

Seed every demo variant so its first paint is the state it is named for, and add the guard that keeps it that way.

**Sixteen of thirty-six shots were three frames repeated.** Every
`geo.address-search` variant painted "Keep typing to search." — `usePlaceSearch`
starts at `query: ""`, which is below `search_min_chars`, so the effect returned
before asking anything and the five canned handler maps were never reached, not
on the first frame and not on any frame, because nothing types into a static
render. Every `geo.location-picker` variant painted the grey `MapPlaceholder`:
`map/config` is the picker's bootstrap read and arrives over `fetch`, so it is
pending on exactly the frame a shot runner keeps. Five variant names and five
handler maps documented states no picture ever showed — which is worse than
declaring one variant, because the gap was invisible precisely where it was
being documented.

**What each variant now shows on its first frame.** `map/config` is written into
the cache before the provider mounts (`seedMapConfig`) and the demo query client
is pinned, so the picker opens on the real map. The search field is handed a
`PlaceSearchBag` — its shipped seam, the prop a host already supplies — held at
the state the variant names: search-as-you-type with rows, a request still in
flight, below-minimum-length, nothing matched, 401, 429 and 502. The picker's
`default` variant opens LOCATED: pin placed and address on screen. The states
the geo contract insists are different are now photographed side by side —
`anonymous` (401 is this deployment's configuration, stated in plain text with
no retry, map and pin still working) against `unavailable` (502, a real fault,
drawn as one with a retry), and `nowhere` (a successful resolve that matched
nothing — an empty state, and the coordinates are still saved).

**`LocationPickerField` takes the address it already has.** New optional
`resolution`, paired with `value`: an edit form hands back the address it stored
and the picker opens on it instead of a blank confirmation line that fills in
half a second later — and skips the reverse-geocode that would re-answer a
question already answered. That is one authenticated call per mount of every
edit screen; under the default `GEOCODER_PERMISSIONS` it is worse than
wasteful, because a signed-out visitor would be told the address is unavailable
while it sits in the field above. Any move of the pin re-resolves as before:
the seed suppresses exactly one request, never the seam. `useLocationPicker`
gains the matching `initialResolution`, and a stored answer with no `feature`
and no `formatted` opens on `nowhere`, because a lake was a successful answer
when it was saved and still is.

**`assertVariantsRenderDistinctly` now runs here**, against the static renderer
and again against the mounted screen once the network and the pin's 400 ms
settle have landed. The static half is the frame a shot runner keeps; the
mounted half catches a variant that starts distinct and CONVERGES, which is what
a seed refetched over by a mock that answers something else looks like.
