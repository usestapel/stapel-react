---
"@stapel/moderation-react": patch
---

moderation: the declared backend contract says `>=0.6 <0.7`, because that is what the storefront it is installed on runs

The pin had been held at v0.3.0 because 0.5.0 is `feat(moderation)!` — marked
breaking by its own author — and a breaking wire change deserves the wave that
exercises the appeal flow end to end rather than a regen ridden in on someone
else's train. That is the right instinct and the wrong conclusion here, and the
hold note itself says why: a hold records a decision, not a fact, and the claim
inside it has to be checked eventually.

Checked: `git diff v0.3.0..v0.6.3 -- docs/schema.json docs/errors.json
docs/flows.json` is **empty**. Both `!` releases break Python extension points,
not HTTP — 0.5.0's appealable draft screening arrives as the `screen_draft` gate
function, 0.6.0's stuck-case recovery as the `rescreen_stuck_cases` beat entry
(which also moved from `stapel_moderation.tasks` to `stapel_moderation.beat`) —
and `docs/capabilities.json` is the only committed contract artifact in the span
that moves at all. So every generated file in this pair regenerates
byte-identical, and this release changes exactly one thing: `manifest.json` and
`llms.txt` stop announcing `>=0.3 <0.4` while the deployment runs 0.6.3.

That is worth a version of its own rather than a silent repo-local edit. A
declared range that no longer contains the backend is the seam defect in its
purest form — both halves green in isolation, the statement joining them false —
and it is only fixed for anyone outside this repo once the corrected manifest is
published.
