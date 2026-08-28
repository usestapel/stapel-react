---
"@stapel/core": minor
"@stapel/auth-react": minor
"@stapel/listings-react": minor
"@stapel/chat-react": minor
"@stapel/reviews-react": minor
---

Auto-anonymous: a gated action can mint an identity instead of refusing.

A marketplace visitor who has not registered could read the catalogue and do
nothing with it. Saving a listing and writing to a seller are the two acts the
product exists for, and both answered "sign in first". They no longer do: the
press mints a guest account silently and then performs the act.

- `@stapel/core` gains the elevation seam — `ElevationSource`,
  `<ElevationProvider>`, `useElevation(action)`. It is per-ACTION on purpose.
  The mandate axis is untouched by a mint, so a minted guest stays
  `"anonymous"` and every action a deployment did not name keeps its wall.
- `@stapel/auth-react` gains `createAuthRuntime({ autoAnonymous: { actions } })`
  and `createAnonymousElevation`, implementing that seam over
  `POST /anonymous/`. It never mints on render, collapses concurrent presses
  onto one mint, and persists a `device_id` so a reload does not abandon the
  first guest along with what they saved.
- `@stapel/listings-react` exports `LISTINGS_ELEVATION_ACTIONS` and
  `useElevatableMandateGate`; the favourite heart takes the named action.
  Publishing deliberately does not.
- `@stapel/chat-react` exports `CHAT_ELEVATION_ACTIONS`; "message the seller"
  takes the named action.
- `@stapel/reviews-react` exports `REVIEWS_ELEVATION_ACTIONS` and now refuses a
  mandate-less visitor BEFORE the click rather than after it. It also
  recognises `error.403.reviews_anonymous_not_allowed`: a signed-out visitor
  is refused with 401 and a minted guest with 403, and both mean "you need an
  account", so `isSignInRequired` reads both.

`@stapel/auth-react` also gains `<AuthPanel showGuestEntry>`. With the axis
open the backend advertises `registration.anonymous` and the panel would draw
"Continue as a guest" — on a host that mints automatically that button mints a
session and leaves the person on the sign-in screen, which is the silent
control that got the capability switched off somewhere once already. The
server's statement stays true; the host says whether it is obtained by
pressing that.

WHICH actions may mint is a host's list, not a library default. A host that
wires nothing sees no change: every gated control refuses exactly as before.
