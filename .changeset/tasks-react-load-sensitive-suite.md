---
"@stapel/tasks-react": patch
---

The suite stops depending on how loaded the machine is. Three defects, none of
them in the assertions:

**`prodBundlePurity` ran `npm pack` inside the parallel turbo graph.** The
tarball check shells out to `npm pack --dry-run` — 7.6s of real I/O on an idle
machine, 49s when the fleet's suites run four wide, against a 30s budget. Every
other pair moved this out of `test` and into a serialized `test:pack` script
(CI runs it with `--workspace-concurrency=1`); this one was missed. It now
follows the same split, and tolerates npm >= 11's object-shaped `--json` report
the way the rest of the fleet already does.

**`test/vitest.setup.ts` never unmounted anything.** vitest runs without
injected globals, so testing-library's automatic cleanup never registers. Files
that declared their own `afterEach` were covered; `demos.test.tsx` was not, so
every demo it mounted stayed mounted for the rest of the run and React kept
scheduling work into the environment teardown — `ReferenceError: window is not
defined`, reported as an unhandled error after a suite whose tests all passed.
Unmounting in the shared setup covers every file and keeps each render's cost
flat instead of growing with the trees before it. `demos` 1859ms → 560ms,
`defaultSkin` 4051ms → 1288ms, `taskSheet` 5355ms → 2061ms.

**"follows the document's theme rather than a light literal" counted
microtasks.** The flip travels `MutationObserver` → `useSyncExternalStore` →
render; the test awaited exactly one resolved promise inside `act` and then
asserted, which bets on how many ticks that path takes. It waits for the
outcome instead. `data-theme` is now cleared in `afterEach`, so a failure there
can no longer leave every later case rendering dark.

Also shims the pseudo-element form of `getComputedStyle`, which jsdom refuses
and antd 6's scroll locker calls on every dialog mount — each refusal was
emitted as a `jsdomError` carrying a full React stack, burying the sheet
suite's real output.
