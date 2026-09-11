---
"@stapel/auth-react": minor
---

The deployment says what kind of stand it is, and a login grant stops being a
door into an account that already exists.

Regenerated against stapel-auth 0.37.0 (pin moved from 0.35.1; the span is
0.36.0, 0.36.1 and 0.37.0). Three things reach a host from it.

**`posture` on the capabilities bag.** `GET /capabilities/` now carries a
required `posture` object — `PostureInfo { preset, stage }`, both nullable —
next to `email_mock`/`phone_mock`, and `useCapabilities()` hands it through
untouched. It is the companion of those two flags: they say a channel is
stubbed, this says whether that is MEANT. A stand can be production — public
host, real TLS, real data — and not yet advertised, and it declares that as
`stage: "prototype"`. This is a READ-ONLY PASS-THROUGH: nothing in the pair
branches on it, it gates nothing, and a host reads it to tell a prototype from
prod in a banner or a monitor. It is also the only way stapel-core 0.64.0's
posture stage reaches a React pair at all — core exposes no endpoint a pair
calls, so the declaration travels on auth's contract. `PostureInfo` is exported
from the package root, typed straight off the regenerated schema; a deployment
that declared no posture answers `{ preset: null, stage: null }`, which is a
distinct answer from one that declared a live stage and is not coerced into
one.

**`error.403.grant_existing_account`.** stapel-auth 0.37.0 closes security
audit finding M-4: `LoginGrantService.exchange()` signed an existing address in
and had no other answer, so a holder of the issuing seam could mail an
MFA-free session into everything that address already owns. The deployment now
picks its answer with `AUTH_LOGIN_GRANT_EXISTING_ACCOUNTS` — `login` (the
default, unchanged), `refuse` (this 403) or `step_up` (a TOTP challenge). The
new key arrives in the generated catalogue with en, ru and es, so a host that
renders `t(code)` says the right sentence in all three without touching
anything; `remediation` is `reauthenticate`, which is exactly what the message
tells the person to do.

**Fourteen route descriptions and three guest-stance notes.** stapel-auth
0.36.0 answered `stapel_core.adoption.W003` for the seven views gated
`[IsAuthenticated, DenyEnrollOnly]` — a companion about enrolment, not
identity, which a guest passes — so `AuthenticatorChangeViewSet` now declares
`ANONYMOUS_DENIED` and carries `IsNotAnonymousUser`, and the erasure and
data-export reads say out loud that a guest reaches them on purpose. All of it
lands as generated doc comments on the typed client: no path, payload, status
code or required set moves, so no call site changes shape.

The declared backend contract range moves `>=0.35 <0.36` → `>=0.37 <0.38`. A
host on this version must run stapel-auth 0.37.x.
