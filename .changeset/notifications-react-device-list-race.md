---
"@stapel/notifications-react": patch
---

`<PushDeviceList/>`'s registry test waited on the wrong async chain. Two
independent ones feed that render: `GET /devices/` produces the rows, while
`currentToken()` → `crypto.subtle.digest` produces the fingerprint that marks
one row as THIS device. The test awaited the rows and then asserted
`push-device-current` synchronously, which assumes the digest always lands
first. It usually does; under a loaded runner it does not, and the failure
reads as a missing marker on a list that clearly rendered. The assertion now
sits inside the same `waitFor`, so it waits for the state that needs both
chains.

Also shims the pseudo-element form of `getComputedStyle` in
`test/vitest.setup.ts`. jsdom refuses it and antd 6's scroll locker calls it on
every dialog mount, emitting each refusal as a `jsdomError` with a full React
stack. Answering the element form is the honest degradation: a document with no
stylesheets has no pseudo-element styles, so an empty declaration is the
correct answer.
