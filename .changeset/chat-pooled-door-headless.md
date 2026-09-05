---
"@stapel/chat-react": patch
---

The pooled sign-in door is reachable from a hand-composed control

`<StartChatButton refusal="pooled">` is not the only compact card control: a
host with its own card geometry composes the headless `<StartDirectChat>` with
the skin's `<GatedButton>` itself, and that pairing could not reach the door at
all — the portal lived inside this pair's own skin component. Such a pane
printed the pooled sentence with nothing to press, which is the half-answer
pooling was fixed for. `usePooledRefusal(reason)` and `<PooledSignInDoor>` are
now exported (the latter reading its scope from the ambient
`GateReasonScopeContext` when none is passed), and they share one claim with
this pair's own button: one door per pane and reason, whoever wrote the
controls.
