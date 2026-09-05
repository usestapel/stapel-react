---
"@stapel/profiles-react": patch
---

`<PersonRow size="compact">` — the same identity in the space of a caption

Both existing shapes are list furniture: a 40px row with a second line under
the name, and a 72px page header. Neither fits the one line under a listing
card that says who is selling, so a storefront wrote its own — its own anchor,
its own avatar, its own fallback for an unnamed profile — which is how a user
id gets back onto the glass. The compact arm is a 20px avatar
(`PERSON_COMPACT_AVATAR`), the name (a real link when `href` says so), the
second line inline rather than stacked, and a new `trailing` slot for what
qualifies the name — a rating, a mark — in every arm. The four batch states
stay four.
