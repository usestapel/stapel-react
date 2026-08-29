---
"@stapel/geo-react": minor
---

**"Where is it?" is a field now, and a refused location prompt is not a dead end.** `LocationField`, `useResolvedLocation`, and no latitude or longitude on screen anywhere.

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
