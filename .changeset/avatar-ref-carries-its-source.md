---
"@stapel/profiles-react": minor
---

fix(profiles-react): an uploaded avatar carries its own provenance

`useAvatarUpload().upload()` resolved a bare ref string, and that destroyed the
provenance at the exact instant the system knew it for certain. The CDN upload
endpoint returns — this IS a CDN ref, there is no doubt anywhere in the call
stack — and the hook handed back a `string`. The caller then had to remember,
out of band, to also write `avatar_source: "cdn"`; the profile model's default
is `file`, so forgetting was silent.

Nobody remembered. On the meettoday sandbox **2 of 2** profiles that ever had
an avatar were stored as a CDN ref tagged `file` — a 100% failure rate of the
manual upload path, reproduced independently on two people. Serializing such a
row opened the CDN variant DIRECTORY as a plain file and raised, so
`/profiles/api/v1/me` 500'd; the frontend then read no `display_name`, concluded
the account was unnamed, blocked the meeting door with an "enter your name"
dialog, and that dialog's PATCH 500'd on the same avatar. A cosmetic reference
locked two people out of the product.

An obligation between two libraries that lives in prose is an obligation a
caller is required to remember, and one day does not. So:

- **`upload()` now resolves `AvatarRef` — `{ref, source}`** (breaking for a
  caller that used the return value directly; pre-1.0, no shim).
- **`useSetAvatar()` (new)** makes setting an avatar ONE library operation:
  upload, then store both halves together. There is no intermediate state in
  which a ref exists without the tag that explains it. `<ProfileSettings/>`
  uses it.
- `useAvatarUpload` no longer throws at render when the subtree has no
  `<StapelConfigProvider>` — that blanked whole tabs over an avatar picker.
  The missing wiring surfaces from `upload()` as an ordinary error.

Requires `stapel-profiles >= 0.12`, which also derives the source server-side
from the reference shape. That is the net; this is the mechanism.
