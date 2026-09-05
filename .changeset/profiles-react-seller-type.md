---
"@stapel/profiles-react": minor
---

`seller_type` on the public profile — regenerated against stapel-profiles 0.19.0.

`GET /{user_id}` and `POST /batch` now carry the self-declared trading
capacity, so a storefront can tell a private seller from a shop off the read
that already answers who they are, instead of a second lookup into the
comm-layer projection. `PublicProfile` (and every profile in `ProfileBatch`)
exposes it.

- `sellerTypeLabelKey` / `sellerTypeLabel` (new, exported from `/default`) turn
  the wire value into a word: `private` → «Частное лицо», `business` →
  «Компания», in every locale this package carries (en/ru/es). A capacity a
  deployment registered itself gets no key and its own value stays on screen —
  a made-up caption would be worse than an identifier. `null` — which the wire
  uses for BOTH "this deployment's profile model has no such field" and
  "nobody declared one", deliberately indistinguishable — says nothing at all.
- `<PublicProfilePage>` draws it under the location.
- **`rating` is gone from the schema, and from this page.** It named no live
  field: the migration that added it was reverted inside stapel-profiles' first
  release and neither public serializer ever listed it, so `profile.rating > 0`
  has been `undefined > 0` on every profile this pair has ever drawn. The
  `PUBLIC_RATING_MAX` export and the `profiles.public.rating*` keys go with it.
