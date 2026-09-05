---
"@stapel/cdn-react": patch
---

The upload queue stops writing state into a control that has gone away.

`useUploadQueue` aborts everything still in flight when it unmounts — a person
who navigates off mid-upload should not leave requests running against a
component that can no longer report what happened to them. But an abort REJECTS
the upload's promise, and that rejection's handler is the code that patches
`phase: "canceled"` in. The tidy-up was reliably scheduling the write it exists
to prevent, one microtask after the tree was gone.

In a browser that write is a pointless update to nothing. In CI it landed after
the test environment was torn down and surfaced as `ReferenceError: window is
not defined` out of React's `resolveUpdatePriority` — every cdn-react test file
green and the run failed anyway, which blocked a release train.

`patch` is the single door every one of those writes goes through, so an `alive`
ref is checked there and cleared BEFORE the aborts fire. Re-mounting opens it
again, so StrictMode's double-invoked effects and a control that comes back are
unaffected. Nothing about the queue's behaviour on screen changes.
