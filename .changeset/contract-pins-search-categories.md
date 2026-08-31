---
"@stapel/categories-react": patch
"@stapel/currencies-react": patch
"@stapel/listings-react": patch
"@stapel/calendar-react": patch
---

Regenerated against the contracts the fleet actually installs.

`contract-pins.json` moves stapel-search 0.4.0 → 0.7.0 and stapel-categories
0.7.0 → 0.9.0 — the two pins the freshness gate reported as three and two
minors behind, and the two versions a live classified deployment now runs. A
pair regenerated from a stale pin is internally consistent and wrong about the
wire, which is the whole reason the gate exists.

What the regeneration brings in:

- `search-react`'s `GET /suggest` grows `categories[]` — a destination per row
  with its full ancestor path, the number of LIVE listings behind it and a
  `category` string to pass verbatim to `/query`, ranked by that count. The
  answer is now public and conditional (`Cache-Control` + `ETag`), which is
  what makes a per-keystroke read reasonable.
- `categories-react`'s feature-config union gains `group` — attributes v2's
  container type, whose config holds its children as raw dicts each
  discriminated by its own `type`, plus an optional `repeat`. The pair's
  discriminator contract test pins thirteen members instead of twelve; it
  checks in both directions on purpose, and this is the direction that was
  supposed to fire.
- `calendar-react` and `search-react` raise their `@stapel/tokens-antd` peer
  floor to the release that first ships `visuallyHidden`, which both now
  import. The monorepo cannot catch that by building — in here every package
  compiles against the workspace peer, never against its own declared floor —
  so only a consumer installing at the floor would have found it, after the
  release.
