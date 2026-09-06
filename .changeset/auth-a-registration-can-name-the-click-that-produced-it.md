---
"@stapel/auth-react": minor
---

auth: the pin moves to stapel-auth 0.34.2, and the pair's generated surface gains an attribution object, a host→brand read, and one new error key

The pin had been held at v0.30.0 with a written reason: the 0.31/0.32 span was
the multibrand wave's per-host auth contract, `@stapel/auth-react` consumed none
of those endpoints, and the regen belonged to that wave rather than to the
picker train that hit the gate. That reason was true of the span it described.
It stopped covering the span, so the hold is lifted rather than carried:

**0.33.0/0.33.1 — a reload racing a refresh is a browser, not a replay.** The
refresh now has a grace window, with the CAS race that the first cut left open
closed behind it. Nothing in the generated artifacts moves for it, and it is the
single most load-bearing change here: it is exactly the sequence this pair's
token-refresh seam produces when a person reloads a tab mid-refresh, and until
0.33.1 the second caller could be read as a replay of a stolen token.

**0.34.0/0.34.1 — a registration can say which ad click produced it.**
`schema.ts` gains `SignupAttribution` (`click_id`, `click_id_type` as the new
`ClickIdTypeEnum` of `gclid | gbraid | wbraid`, `captured_at`, optional
`SignupUtm`) and an optional `attribution` on `EmailAuthVerify`, `PhoneAuthVerify`
and `OAuth`. Optional on every one of them, so no existing call changes shape —
what changes is that a host that captures the click on its landing page now has
a typed slot to put it in. `errors.json`/`AuthErrorCode` gain
`error.400.attribution_invalid` (`fix_input`, no params: the object is written
by capture code, so a shape error is a bug to fix and not a form for the person
to correct). The module ships **both** `ru` and `es` for it, so `gen:errors`
carried them and this pair authored nothing by hand.

**0.34.2** adds the by-id user projection read for consumers, and the span also
brings in the per-host work the original hold described — `GET /auth/api/v1/site/`
(host → brand, `AllowAny`) is now in the generated paths, `manifest.json` and
`llms.txt`.

`manifest.json`'s declared backend contract moves `>=0.30 <0.31` → `>=0.34 <0.35`:
the published pair now states the release it is actually generated from.
