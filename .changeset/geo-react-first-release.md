---
"@stapel/geo-react": minor
---

A new pair: the human half of a location.

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
