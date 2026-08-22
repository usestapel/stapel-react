---
"@stapel/core": minor
---

`StapelClient` query parameters accept an ARRAY, and repeat the key instead of
collapsing it.

`{ "f.brand": ["bosch", "makita"] }` now becomes `?f.brand=bosch&f.brand=makita`,
in the given order. Repetition is a contract some backends actually specify —
stapel-search reads a repeated `f.<slug>` as OR within a slug and different
slugs as AND (`stapel-search/query.py`) — and the builder used `set`, so the
second value silently replaced the first. The only alternative for a pair that
needs it was to hand-build its URL: a second query encoder next to this one,
outside its escaping and outside `stapel/no-string-paths`.

An empty array contributes nothing, exactly like `undefined`: "no filter" and "a
filter with no values" must not produce different URLs. Single values keep their
existing `set` behaviour, so nothing already shipped moves.
