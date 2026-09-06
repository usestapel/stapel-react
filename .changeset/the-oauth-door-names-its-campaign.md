---
"@stapel/auth-react": minor
---

auth: the OAuth door says where the sign-up came from, and the enum stops being three Google flavours

Pin → **stapel-auth v0.34.3**. The contract range is unchanged (`>=0.34
<0.35`); the wire moved additively inside it.

**The contract half.** `ClickIdTypeEnum` widens from `gclid|gbraid|wbraid` to
`gclid|gbraid|wbraid|yclid|fbclid|ttclid` — Yandex Direct, Meta, TikTok Ads —
and `SignupAttribution` drops `click_id`/`click_id_type` from its required set:
a landing that carries no click id at all (an email campaign, a price
aggregator) attributes through `utm.source` instead of being reported as direct
traffic. `error.400.attribution_invalid` restates itself around that and gains
a `captured_at` param; ru and es ship upstream, so the locale bundles moved
with the generator and nothing was hand-written.

`SignupAttribution` is now a **direct alias** of the generated schema. It was
hand-transcribed, for a reason that had expired — the pinned contract's verify
serializers used to predate the field and no longer do — and the copy went
stale exactly the way a parallel definition does: every host of this pair would
have gone on being unable to send a `yclid` or a UTM-only record, at the type
level, long after the server accepted both. New export: `ClickIdType`.

**The door half.** `<OAuthPanel>` built its authorize address out of one thing,
the redirect URI, and an OAuth sign-up is a REGISTRATION — an account created
by "continue with Google" is exactly the conversion a campaign paid for. It was
the one door of `<AuthPanel>` that could not say where it came from, so a
storefront hand-built the URL or smuggled the tags inside `redirect_uri`, where
they came back on its own address and had to be scrubbed.

`<AuthPanel attribution>` — the same prop the email/phone panels already read —
now reaches `<OAuthPanel>` (through the bottom row, where OAuth actually lives)
and is written onto the authorize address as the flat query stapel-auth's
`attribution_from_query()` reads:

```tsx
<AuthPanel attribution={capturedOnLanding} />
// → /oauth/google/authorize/?redirect_uri=…&click_id=…&click_id_type=yclid
//   &captured_at=…&utm_source=…
```

The redirect has no request body, so this is the only channel it has; the
server parks the tags in the flow state the callback already opens, and the
identifier never travels through the provider. A function prop is read when the
door is BUILT — at submit for the verify call, at **render** for the OAuth
`<a href>`, which has to be complete before anyone can click it.

New export `attributionQuery(attribution)` does the flattening for a host
building the address itself. Blank and absent are one statement and are written
as absence (the server strips a blank identifier before it validates); a record
the server would refuse is written verbatim rather than repaired, because the
door answers a bad tag by dropping it and signing the person in anyway — a
marketing tag must never take a sign-in down, and silently fixing it here would
hide a broken capture from the one place that logs it.

**Additive.** A host that passes no `attribution` gets the address this panel
has always built — `redirect_uri` and not one parameter more — and the OTP
verify body is byte-identical to before.
