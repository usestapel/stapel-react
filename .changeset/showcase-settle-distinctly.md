---
"@stapel/showcase": patch
---

`assertVariantsSettleDistinctly(demo, { render, settle })` — the mounted half of the
variant-distinctness guard.

`assertVariantsRenderDistinctly` compares the first frame: no effects, no microtasks, no
refetch. That is the frame a seeded demo gets right and it is not the frame anybody looks
at — React runs the effects, the query client refetches a seed it considers stale
(`staleTime: 0`, or a `refetchQueries` that ignores it), the demo's catch-all mock answers
`200 {}`, and the state each variant is NAMED for is replaced by one shared error or empty
card while the static guard stays green. chat-react (three `thread` variants on the error
card, three inbox variants on the empty card) and forms-react (`forms-list`, `responses`,
`public-form` photographing a blank page) each found this and wrote the check locally; this
lifts it into the format so no pair rediscovers it.

The new assertion mounts every variant in a live DOM through an INJECTED renderer (RTL's
`render` in a pair's vitest — the package still pulls in no react-dom), awaits `settle`
(default: two macrotask turns inside React's `act`; a played variant gets settle → play →
settle and is compared, unlike the static guard which skips it), and reports three findings
in one error: (a) a variant settled on an error/empty arm it never declared — arms read
from `data-stapel-error` / `data-stapel-empty` / `role="alert"` / an empty container,
declared by the variant's `step` or id naming one; (b) variants that collapsed onto
identical DOM after mount though their first frames differed; (c) anything that reached
`console.error` while settling. `settleVariants(demo, options)` exposes the raw per-variant
records (`markup`, `arms`, `declaredArms`, `consoleErrors`) for a custom report.
