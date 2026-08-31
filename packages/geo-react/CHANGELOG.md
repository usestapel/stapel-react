# @stapel/geo-react

## 0.6.0

### Minor Changes

- 5397813: "Use my position" stops spinning when the browser never answers

  The picker's own locate button calls `getCurrentPosition` directly, and the
  Geolocation spec stops the `timeout` clock while the permission decision is
  pending — so a prompt that is dismissed rather than answered fires NEITHER
  callback, ever. Measured on a live classified deployment: the button stayed in
  "Finding you…" for the whole of a 30s watch (60 probes at 500ms) over a live
  map it could have used all along. `@stapel/core`'s `usePermission` has carried
  that bound for four releases; this button does not go through it.

  `useBrowserPosition` now arms its own deadline — `decisionTimeoutMs`, default
  20s, the same number and for the same reason. When it expires the control
  resolves into an honest state instead of a spinner: the Permissions API is
  asked whether the site is simply blocked, and the outcome is `denied` if it
  says so and `timeout` otherwise, both of which already have a sentence and a
  retry beside the button. 20s and not 10s so that a genuinely slow fix fails as
  `code: 3` first — "we could not place you" and "you never answered" stay two
  different sentences.

  A callback that arrives after the deadline (or after a second `locate()`) no
  longer repaints the control, and the deadline is cleared on unmount.

## 0.5.0

### Minor Changes

- 5f9b005: Refusing geolocation is no longer a dead end in the location field.

  A night e2e run on a live storefront found that a seller who declines the
  location pre-prompt cannot file a listing at all: "Not now" closed the sheet
  and left the field empty, the next tap re-asked the same question, and a
  browser prompt that was opened and never answered left the sheet spinning in
  its `prompt` arm forever. Without a place, Publish never enables.

  The measured cause of the last one is a spec detail worth writing down: the
  Geolocation spec stops `getCurrentPosition`'s `timeout` clock while the
  permission decision is pending, so a prompt nobody answers calls **neither**
  callback, ever — verified in Chromium, where an ungranted context never
  settles while the same call under a granted permission rejects with `code: 3`
  after exactly its `timeout`.

  - **`usePermission`** now always settles. `request()` waits for the attempt,
    but gives up once `decisionTimeoutMs` (new option, default 20s) has passed
    _and_ the Permissions API still reports the question open — so an unanswered
    prompt hands control back instead of hanging, while a slow GPS fix the
    person actually allowed is never cut short.
  - **`PermissionSheet`** renders `fallback` in every arm but `granted`, not
    only when the capability is blocked. The way around was previously offered
    only after a refusal had been recorded, which left "Not now" — the answer
    the sheet's own way out invites — as the one answer with nothing behind it.
  - **`LocationField`** treats every exit from the sheet as the door it always
    documented: dismissing it, or an unanswered browser prompt, opens the picker
    on the IP centre. The position only ever centred the map. The pre-prompt is
    also asked once per field rather than on every tap.

## 0.4.0

### Minor Changes

- 41d2a78: **"Where is it?" is a field now, and a refused location prompt is not a dead end.** `LocationField`, `useResolvedLocation`, and no latitude or longitude on screen anywhere.

  `LocationPickerField` put a BUTTON in the form — "Choose on the map" — and printed the chosen place underneath it. Two problems, one of them fatal: a button beside every real input reads as an action rather than as an answer, so the form's own field stayed visibly empty after the person filled it in; and "choose on the MAP" names the mechanism instead of the question, when most people answer it by typing a street.

  **`LocationField`** is one field. Empty, it says what it is for. Filled, it holds the chosen place INSIDE it, the way a text input holds text. A chosen point the geocoder had no address for still reads as answered ("A place on the map, with no address") rather than looking unfilled, because the place IS chosen.

  **One tap runs the whole ladder**, and it is four things:

  1. permission already `granted` — ask for the fix, open the map on it;
  2. never asked — open the substrate's `PermissionSheet` FIRST. Explaining before the browser's own one-shot prompt is the entire reason the refusal rate is not 100%: fired cold it is denied by reflex, and denial is permanent;
  3. allowed there — the fix arrives from the same call that raised the prompt, so the browser is asked once and not twice;
  4. refused, now or long ago — the map opens anyway, centred on `GET geo/api/v1/ip`. Somebody who already said no is not asked again on every tap; their answer stands. When they refuse in the sheet, the sheet's `fallback` slot carries the same door, so a "no" is one tap from the map instead of a dead end.

  **`useResolvedLocation`** is that ladder, headless: browser fix → the server's IP guess → the deployment's `default_center`, with `source` naming which rung answered. A UI that shows "we found you" over a `default` is lying, and the server says which it is (`ip_resolved`), so the field only claims a city when it was told one. Requires stapel-geo 0.4.1, whose IP verb always answers something a map can open on — an unknown range, a private address and a broken database are all 200 with the fallback centre, so this is a ladder with one branch rather than an error path.

  **No coordinates on screen, anywhere.** The picker used to print `{lat}, {lon}` to five decimals under its confirmation line and again in its summary. That was the original defect wearing a nicer hat: a person choosing where their sofa is does not read 55.75581, and a number they cannot check makes a right answer look technical and a wrong one look authoritative. The address is the confirmation; the coordinate is what gets stored, and storage is not a display concern. `geo.picker.coordinates` is gone from all three bundles; the camera is now readable off `data-geo-center` on the map element, where a test can see it and a person cannot.

  **A chosen suggestion closes its dropdown.** `usePlaceSearch` gains `accept(label)` and `chosen`: taking a suggestion puts its whole label in the field, hides the list, and suppresses the request — and the list comes back the moment the text differs from the label that was accepted. Before this, picking a suggestion left the field holding the fragment the person typed with the dropdown still open over the answer, so the next render re-searched the fragment and re-opened the same list; the only way out was clicking somewhere else. It lives in the hook rather than in the skin, so a host with its own visuals inherits it.

  Also: `PickerBody` moved to its own module (two skins mount it now); `LocationPickerField` keeps working, unchanged apart from losing its coordinate lines; `AddressSearchField` unchanged apart from accepting the label; peer floors raised to `@stapel/core >=0.20.0` and `@stapel/tokens-antd >=0.8.0` for `usePermission` / `PermissionSheet`.

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
