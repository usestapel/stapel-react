---
"@stapel/auth-react": minor
---

The passkey flow is inverted: the system prompt is the first screen, and our
sheet appears only when the ceremony did not sign the person in.

Clicking "Passkey" used to open OUR dialog, which contained a "Use a passkey"
button, which raised the browser's WebAuthn prompt. Two screens of ours in
front of the one screen that decides anything, on neither of which the person
had a choice to make. `pick("passkey")` now calls
`navigator.credentials.get()` immediately and renders nothing; the button
carries the pending state, because with no dialog of ours it is the only place
anything can be seen to be happening.

**Five outcomes, five sentences.** A ceremony rejection is a `DOMException`,
not a `StapelApiError`, so `toFlowError` folded cancelled / no-credential /
timed-out / insecure-origin / authenticator-refused into one shrug —
"Something went wrong. Please try again." — which is wrong for four of them
and worst for the most common, where "try again" is advice to repeat what
cannot work. `classifyWebauthnError` reads the `DOMException` name,
`toPasskeyFlowError` maps it to its own i18n key, and the fallback sheet
branches on `passkeyFailureOf` to decide which ACTION to show: a retry for a
timeout, the other methods for a decline, and nothing to retry at all for a
browser that cannot do this. Cancelled and no-credential stay ONE outcome
whose copy says both — WebAuthn refuses to separate them, because reporting
the difference would make the prompt an oracle for whether an account exists
on the device.

A browser with no WebAuthn now starts no ceremony at all, where it used to run
a `begin` round trip and park on `awaitingAssertion` behind a spinner.

New public surface: `usePasskeyLogin()` (the hook `<PasskeyLogin>` is now a
thin wrapper over — a render prop cannot be driven from outside the subtree it
renders, and the button that starts this is outside), `classifyWebauthnError`,
`WebauthnFailure`, `toPasskeyFlowError`, `passkeyFailureOf`.
