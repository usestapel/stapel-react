---
"@stapel/workspaces-react": patch
---

Regenerated against **stapel-workspaces 0.31.0**: the pin was one minor
behind (pinned past 0.30.2 at a specific commit, `3ca051e`, for the
client-name scrub described below). The declared backend contract moves to
`>=0.31 <0.32` in `manifest.json` and `llms.txt`, retiring the past-tag pin
onto a real release now that `v0.31.0` contains `3ca051e`.

Nothing on the wire changed beyond a cosmetic description string.
`docs/schema.json` moves by exactly the `error_language` field description
stapel-core 0.62.0 already corrected in every other pair; `docs/errors.json`
and `docs/flows.json` are byte-identical.
