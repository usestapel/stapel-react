---
"@stapel/listings-react": patch
---

The last hand-written error override is gone, because upstream fixed the text.

`error.409.invalid_listing_transition` interpolated `{from_status}` — the wire
value, `draft` / `archived` — into translated prose, so a seller read an English
status word inside a Russian sentence two lines under a status tag rendered in
their own language. This pair carried a local override for exactly that, with a
note saying to remove it when upstream dropped the placeholder.

stapel-listings 0.22.10 dropped it, in all three languages including the en
canon, so the contract pin moves to `v0.22.10` and the refusal is regenerated:

- en `Invalid status transition for {from_status}` → `This listing cannot move to that status from the one it is in now`
- ru `Недопустимая смена статуса для «{from_status}»` → `Из текущего статуса объявление нельзя перевести в выбранный`
- es `Cambio de estado no válido para {from_status}` → `El anuncio no puede pasar de su estado actual al estado elegido`

The override is deleted and this pair now authors nothing at all under
`error.*`. The assertion that guarded the override — `toContain("{from_status}")`
over the generated bundle — is **inverted rather than removed**, so both ways
this could regress stay red: a re-added placeholder upstream, and a re-added
hand-written copy here. `params.from_status` is unchanged and is still what
`ListingActions` reads.
