---
"@stapel/listings-react": patch
---

listings: a confirmation toast no longer outlives the surface that spoke it — and the suite now says so per test

**The defect, as CI met it.** `@stapel/listings-react#test` was failing two runs
in three on inputs whose turbo hash had not moved: all tests passed, and the job
then died on an unhandled `ReferenceError: window is not defined` thrown out of
react-dom, blamed on `test/favoriteFeedback.test.tsx` and `test/detail.test.tsx`.
Neither file was at fault, and no `--pool` setting was going to fix it.

**Root cause.** `useNotice()` raises its confirmation through a holder mounted
OUTSIDE the component tree — antd's `<App>` holder where a host mounted one, and
otherwise a React root antd's static `message` entry renders into the document on
first use. Nothing unmounts either when the surface that spoke unmounts. And a
standing notice is not an idle DOM node: `@rc-component/notification` counts its
`NOTICE_SECONDS` down with a **`requestAnimationFrame` loop**
(`useNoticeTimer`), and `@rc-component/util`'s `raf` captured
`window.requestAnimationFrame` at module load. So the listing page's heart toast
kept stepping frames after the test that pressed it, after `cleanup()`, and past
the end of the file — and the frame that landed once vitest had torn the jsdom
environment down called into a `window` that no longer existed.

**The fix, in the source.** `useNotice` now keeps the handle antd returns for
each notice it raises and **retires them on unmount** (each handle also retires
itself the moment its notice closes on its own, so the set holds only what is
still on screen). Both arms, contextual and static.

**Behaviour change, and it is the intent.** A person who presses the heart and
immediately navigates away no longer gets "Saved" floating over the next page,
about a listing they have left. The toast has always been the AMPLIFIER of a
gesture on a surface and never the record of it — the heart's own fill and the
share menu's own sentence are the record — so an amplifier with nothing left to
amplify is closed rather than left running. A host that wants a confirmation to
survive the surface should raise it from a component that survives too.

**The gate.** `test/vitest.setup.ts` now asserts, after `cleanup()` and per test,
that the test left behind **no pending animation frame** and **no unhandled
rejection**, both read-and-reset so a leaking test reddens itself and not the
twenty after it. Verified to fail on the unfixed source, on exactly the two
files CI named, and to pass on the fixed one. `favoriteFeedback.test.tsx` also
now awaits the write its detail-page gesture starts, instead of ending with a
POST in flight.
