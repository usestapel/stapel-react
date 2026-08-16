---
"@stapel/core": minor
---

The mandate axis, and a nav contract that can express it.

stapel-core 0.27 made the backend's principal three-valued — anonymous, a
registered **guest** holding no mandate anywhere, and a member — plus an
explicit *undetermined* outcome for when the answer cannot be obtained. The
frontend had one bit. A guest satisfied "authenticated", was handed every
installed module's nav entry, mounted every screen, and collected a 403 per
click: controls that lead to a refusal, at library level.

`mandate.ts` carries the vocabulary. `MandateState` is `anonymous | guest |
member | unresolved`, and the fourth value is deliberately NOT a principal:
**"we could not ask" must never render as "you may not".** The type enforces
that three ways rather than asking politely — `unresolved` carries no
principal to read, it carries a REASON (`asking` = a wait, `unavailable` = an
error with something to say), and `matchMandate` takes five REQUIRED arms, so
letting a wait fall into a refusal's branch does not compile. It is the same
mechanism `matchList` uses, for the same reason.

`NavEntry` gains `surface: "public" | "member"`. `requiresAuth` stays and
still means what it meant — it is the alias half (`true` → member), so every
manifest written before the axis keeps its meaning — but it could only ever
say "needs a session", and a session is not a mandate. `surface` says the
part it could not: a meeting joined by link is public to an authenticated
person. `navEntrySurface()` is the one place the derivation lives;
`navSurfaceVisibleTo()` is the whole rule, and it takes a
`MandatePrincipal` — `"unresolved"` is not assignable, so a caller whose
mandate has not settled cannot get a verdict out of it at all.

`useActiveSessionStatus()` exposes the status the session store already
held. `useActiveSessionReady()` answers "may a query fire", which is one bit
and rightly so; the axis needs the distinctions underneath it, and deriving
them from a boolean is impossible.
