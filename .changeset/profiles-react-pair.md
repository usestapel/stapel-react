---
"@stapel/profiles-react": minor
---

New pair: **`@stapel/profiles-react`** — the headless React pair for
stapel-profiles, the second pipeline pair scaffolded from the re-etalon
(`stapel-new-react-lib`, G1–G8) after notifications.

- **API layer** — typed operations over the injected `StapelClient`
  (`getMyProfile` / `updateMyProfile`, `getProfile`, `getRelationship`,
  `follow` / `unfollow` / `block` / `unblock`, `getMyFollowers` /
  `getMyFollowing` / `getMyBlocked`, `listLanguages`) with schema aliases from
  the unified OpenAPI (`ProfileResponse`, `ProfilePublicResponse`,
  `PatchedProfileUpdateRequest`, `RelationshipResponse`, …) and two documented
  corrections: `RelationshipStatus` narrowed from the schema's bare `string` to
  `"neutral" | "following" | "blocked" | "self"` (backend `RelationshipStatus`
  choices + the public serializer's `self`), and `Blocked` typed as a `user_id`
  list where drf-spectacular emits a bare `array`. The token-based
  `/notifications/unsubscribe` email surface is deliberately omitted.
- **Model hooks** — reads `useMyProfile`, `useProfile`, `useRelationship`,
  `useMyFollowers` / `useMyFollowing` / `useMyBlocked` (each `enabled`-gated),
  `useLanguages`; writes `useUpdateMyProfile` and the four relationship actions,
  each invalidating exactly the server state it moves. Query keys come from the
  namespaced `profilesQueryKeys` factory.
- **Headless components** — `MyProfile` (view + partial-update),
  `Relationship` (status + follow/unfollow/block/unblock for a target), and
  `ConnectionList` (followers/following/blocked, one active list fetched at a
  time), plus the scaffold's `ProfilesProvider`. Every headless export is
  covered by a demo (completeness gate green).
- **i18n** — English fallback bundle for the pair's UI keys plus the generated
  backend error bundle (51 keys from stapel-profiles `docs/errors.json`, each
  with a `remediation` hint; `error.404.profile_not_found` is canonically
  `fix_input`, overriding the heuristic's retry-for-404). 0 flows — profiles
  annotates no `@flow_step`, which the zero-flow codegen handles as a valid
  empty registry.
- **Tests** — happy-path hook + headless render tests (my-profile view/save,
  relationship follow-flips-status, connection-list render, and a
  localizable-error path over msw), the generated errors-bundle and demo-smoke
  families, and the prod-bundle-purity gate.
