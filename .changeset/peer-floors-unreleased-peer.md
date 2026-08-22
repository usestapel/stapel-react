---
---

`scripts/check-peer-floors.mjs` no longer fails on a peer that has simply never
been released.

The gate refuses to run blind: if a peer has no release tags, every lookup would
answer "unknown" and the check would pass on a package it never examined. But
"the checkout has no tags" and "this one peer is unreleased while 122 other
`@stapel/*` tags are right there" are different situations, and only the first
is a broken gate. Conflating them meant the first pair to depend on a newly
landed, not-yet-published package reddened CI for a reason that had nothing to
do with its floor — `@stapel/search-react` on `@stapel/attributes-react`, which
landed a day earlier and has no tag yet.

An unreleased peer now logs a note and is skipped, exactly as a symbol that
predates every tag already was; a genuinely tagless checkout still fails with
the fetch-tags instruction. Repo tooling only — no published package changes.
