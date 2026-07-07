# @stapel/profiles-react

## 0.1.0

### Minor Changes

- eb94408: Russian locale as an opt-in `@stapel/profiles-react/i18n/ru` subpath
  (i18n-shipping wave 2, following the auth-react etalon — wave 1).

  - `errors.ru.gen.ts` — generated per-locale error bundle, auto-discovered by
    the shared `gen-errors.mjs` driver from stapel-profiles's
    `translations/errors.ru.json` catalog. `pnpm gen:errors:check` remains the
    drift gate; existing en outputs are byte-identical.
  - `@stapel/profiles-react/i18n/ru` — `profilesI18nBundleRu` (generated
    backend ru + hand-written ru UI copy) and `registerProfilesI18nRu(engine)`,
    which registers the en floor UNDER the ru texts so a missing key degrades
    to English, never to a raw key. Host bundles registered after the pair's
    win (merge-priority convention, now documented on `registerProfilesI18n`).
  - Tree-shake purity is gated twice: the main-entry size-limit budget is
    unchanged (the ru locale is not in its graph; the ru subpath is its own
    chunk with its own budget) and `test/i18nRu.test.ts` walks the compiled
    `dist/index.js` module graph asserting the ru modules never appear.

- a70c561: New pair: **`@stapel/profiles-react`** — the headless React pair for
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

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
