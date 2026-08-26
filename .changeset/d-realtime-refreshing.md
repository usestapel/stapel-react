---
"@stapel/realtime": patch
---

Publish a session refresh that is in flight as `refreshing: { since } | null` on `RealtimeState` (and through `useRealtimeState()`).

A 4401 sends the session through core's single-flight `refresh()`, and for the moment that takes, a shell had nothing to render but a socket that looks broken. The field is set when the 4401 path enters the refresh and cleared when it lands — for renewed, no verdict and refused alike, so it names the question and never an outcome; those three stay where they already live, in `state`/`refusal`. `since` comes from the injectable clock, and the README's debounce advice is to render "renewing your session" only after a threshold has passed, because a healthy refresh answers in well under a second.

Additive: the `RealtimeConnectionState` union is deliberately untouched, so no exhaustive `switch` over it changes.
