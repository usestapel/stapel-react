# @stapel/geo-react

## 0.3.0

### Minor Changes

- f452cfe: Seed every demo variant so its first paint is the state it is named for, and add the guard that keeps it that way.

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

## 0.2.0

### Minor Changes

- 2087398: Spanish, and the theme root gets drawn.

  **`./i18n/es`.** The pair shipped a Russian bundle and no Spanish one, so a
  Spanish host rendered English copy in the middle of its own UI — invisible in
  every test, because every test runs in one locale. `src/i18n/es.ts` mirrors
  `ru.ts` key for key: the generated `geoErrorBundleEs` spread first, the eight
  `stapel_geo`-owned codes authored beside it (the module ships no
  `translations/`), then the 30 UI keys. `test/i18nEs.test.tsx` pins coverage,
  placeholder parity against the English bundle, and a real render under `es`.

  **The default-skin gate goes 3/4 → 4/4.** `GeoSkinTheme` was listed in the
  picker demo's `covers` but never imported from `src/default` there, so nothing
  rendered it under its own name — which is exactly the hole the gate checks for.
  It now has a `dark` variant that mounts it explicitly at phone width. That is
  not a formality: the wrapper exists because a skin with no internal theme
  provider once inherited a host bridge serving light-mode values inside a dark
  document and rendered text on background at 1.00:1, and pinning the mode is the
  one use its `mode` prop is for.

- 407a6e3: A new pair: the human half of a location.

  The owner opened a live product's listing composer and found two raw fields,
  `latitude` and `longitude`, and said geo was useless. The cause was structural
  — this pair had never existed, so the library shipped coordinates and every
  product invented the human half for itself, or did not. A coordinate is not how
  a person chooses a place: a person points at a map, types a street, or presses
  "where I am", and reads an address back to check.

  The headless layer is mostly the four things a picker gets wrong:

  **The axis.** `coordinates` is `[lon, lat]` while every request parameter is
  `lat, lon`. The swap happens once, in `model/coords.ts`, and nothing else
  indexes that array — both numbers are plausible in both slots, so a
  transposition does not crash, it lands the pin in the Mediterranean.

  **"Not available to me" is a state, not an error.** The four geocoding verbs
  default to authenticated-only, so 401/403 is the deployment's normal
  configuration for a signed-out visitor. `availabilityOf` sorts that from a 429
  (the server asking for quiet — keep the last good suggestions), a 502 (the one
  retryable failure) and a real fault. The map and the pin never depend on any of
  it; only the address does.

  **An empty answer is an empty state.** A successful resolve with no feature
  means there is no address at that point. The middle of a lake has coordinates
  too.

  **The browser's refusals are four, not one** — denied, unavailable, timed out,
  and no API at all: four sentences, three different next actions, and the server
  sees none of them.

  Two further decisions worth naming. The search hook debounces and aborts on the
  numbers `map/config` ships rather than constants of its own — they are the
  operator's discipline, and a superseded request that lands late is how a field
  appears to ignore what was typed. And the pin does not move to the geocoder's
  snapped coordinate: the person put it where it is, and watching it jump after a
  pause is the most disorienting thing a map picker can do.

  Contract: stapel-geo 0.4.0.
