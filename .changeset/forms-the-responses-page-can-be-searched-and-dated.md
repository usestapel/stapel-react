---
"@stapel/forms-react": minor
---

forms: the pin moves to stapel-forms 0.6.2 — the responses page gains four optional filters in its types, and a thirteenth attributes-owned error key gets ru/es

The pin had been held at v0.4.0 on the claim that the 0.5/0.6 span is "the ADMIN
half of forms" and that `@stapel/forms-react` "draws none of it: the admin
surfaces are Django's". Most of that survives reading the code — 0.6.0's
definition-driven response table and config builder, 0.6.1's double-encoded
payload fix and 0.6.2's `W004` check really are Django's, and 0.5.0's
merged-away guest keeping their answers really is server-side bookkeeping. One
part does not:

**`docs/schema.json`'s only change in the whole span lands on an endpoint this
pair already draws.** The keyset responses page `ResponsesPane` renders under
`forms.responses.view` gains four optional query parameters: `q`
(case-insensitive substring over answer values), `field` (scope `q` to one
question slug — an unknown slug is `error.400.forms_unknown_field`, never a
silently empty page), `since` and `until`. All four optional, so the pane keeps
working untouched; what it has now is the typed room to offer a search box and a
date range instead of paging to find one answer.

**`error.400.feature_invalid_rules` — a thirteenth `stapel_attributes` key.**
The family is generated from the registry, but attributes ships no
`translations/` directory, so `gen:errors` runs this module with
`ERRORS_LOCALE_EXEMPT_OWNERS=stapel_attributes` and emits `Partial` ru/es
bundles that the pair fills in. `Неверные правила для «{feature}»` and `Reglas
no válidas para «{feature}»` are authored here beside the other twelve, to the
same unreviewed-authored grade the rest of that family is stated to be. The
counts that name the family in `keys.ts`, `ru.ts` and the i18n test move with it
(75 keys/12 attributes-owned → 76/13, 10 `error.400.feature_*` keys → 11), so
the next key that arrives fails the count rather than slipping in untranslated.

`manifest.json`'s declared backend contract moves `>=0.4 <0.5` → `>=0.6 <0.7`.

The `i18n/ru` size limit moves `5 KB` → `5.25 KB`, on a measurement rather than
a guess: the one added Russian string put the built bundle at **4999 B** against
a 5000 B ceiling. It passed, and a gate with one byte of headroom is a gate that
fails on the next translation or on a byte of brotli difference between this
desk and the runner — which is a false alarm, not a finding. `5.25 KB` restores
roughly the same ~5% margin the pair's other entries carry (`index` 12039/13000,
`default` 17008/18000, `i18n/es` 3836/4000).
