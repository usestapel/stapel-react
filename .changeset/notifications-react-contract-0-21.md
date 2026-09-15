---
"@stapel/notifications-react": patch
---

Regenerated against **stapel-notifications 0.21.0**: the pin was two minors
behind (0.19.1), which failed the fleet's contract-freshness gate. The
declared backend contract moves from `>=0.19 <0.20` to `>=0.21 <0.22` in
`manifest.json` and `llms.txt`.

Nothing on the wire changed beyond a cosmetic description string.
`docs/schema.json` moves by exactly the `error_language` field description
stapel-core 0.62.0 already corrected in every other pair (this package's own
0.19.2 had already picked it up once against a stale local venv; this bump
re-confirms it against the pinned contract). `docs/errors.json` and
`docs/flows.json` are byte-identical across 0.19.1..0.21.0. 0.20.0/0.21.0
themselves are explicitly "no schema change, no API change" per their own
changelog — three new billing-letter notification types and an
`EMAIL_PROVIDER`-family environment switch, both server-side.
