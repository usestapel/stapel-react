---
"@stapel/profiles-react": minor
---

The social half of the pair ships: default skins, routes, and an identity layer.

Nine of stapel-profiles' sixteen operations — every follow, block, relationship
and connection-list endpoint — reached no rendered control at all. A host
installing this pair got a settings page and nothing else. New in `/default`:

- **`PersonRow`** — the pair's one identity primitive (avatar or monogram,
  display name, quiet second line). It carries the batch's four-state answer
  through instead of flattening it, so "no profile row yet" is a placeholder
  and "not resolved yet" is a skeleton. A user id never reaches the glass.
- **`ConnectionList` / `ConnectionsPage`** (`profiles.connections`) — the
  followers / following / blocked lists, joined to `POST /batch` for the
  identities, with a per-list designed empty state and a relationship control
  per row whose status the batch already answered.
- **`Relationship`** — follow / unfollow / block / unblock. One primary; block
  is a quiet danger link behind `SkinConfirm`; a switched-off control states
  its reason as text beside it via `GatedButton`. `self` renders as a sentence
  with no controls instead of contradicting live buttons.
- **`PublicProfilePage`** (`/u/:userId`) — "look at somebody", including the
  empty-but-renderable profile stapel-profiles 0.15.0 introduced, drawn as a
  person rather than as an error card.

`LanguageSettings` and `NotificationPreferences` were finished screens with no
route and no parent: `ProfileSettings` now composes them (the way auth-react's
`SecuritySettings` composes its widgets), and both also gained submenu routes.

**Breaking (pre-1.0, hence minor):**

- `src/api/cdnAvatarApi.ts` is deleted. `useAvatarUpload` calls
  `@stapel/cdn-react`'s generated client, which is a new **required peer**
  (`>=0.3.0`). Avatar upload paths are now relative to the CDN base, so a host
  wiring `clients={{ cdn }}` must base that client at the CDN root
  (`/cdn/api/v1/`) rather than at the origin; a mounted `<CdnProvider>` is
  used as-is and needs no change.
- `ProfileSettings` renders the two composed sections by default
  (`showLanguage` / `showNotifications` turn them off).

Also: contract regenerated against stapel-profiles 0.16.0 (`>=0.16 <0.17`) —
`error.400.avatar_url_scheme` / `avatar_url_host` / `avatar_gravatar_hash` had
no frontend text, so every avatar-validation refusal rendered as "something
went wrong"; the Spanish bundle now covers every pair-owned UI key instead of
backend errors only; counts go through ICU plurals; the notification matrix
reflows on its own container width and every switch has an accessible name;
the local `theme`/`ErrorAlert` copies are gone in favour of
`@stapel/tokens-antd/skin`. Doctrine lint for this package: 77 warnings → 0.
