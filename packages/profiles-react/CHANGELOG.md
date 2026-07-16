# @stapel/profiles-react

## 0.3.2

### Patch Changes

- ae57230: v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
  flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
  gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
  `baseUrl` examples and the auth QR same-origin guard now use
  `/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
  literals carry the new version segment. Mount your runtimes at
  `/<mod>/api/v1/`.

## 0.3.1

### Patch Changes

- 2fa025a: §17 arch-contract-pipeline Wave 2 + Wave 3 — the five original pairs are now
  self-contained per-module contracts, aligned to their backend minor.

  **Wave 2 (contract isolation).** Each pair generates its typed surface from its
  backend module's OWN committed `docs/{schema,flows}.json` (byte-identical to the
  former monolith slice) instead of the unified monolith aggregate:

  - `gen:api` emits a package-LOCAL `src/api/generated/schema.ts` per pair (via the
    `API_SCHEMA`/`API_OUT` knobs — the calendar/recordings §17-native shape);
    `api/types.ts` aliases `components` from `./generated/schema.js`, no longer from
    `@stapel/core`. `@stapel/core` stays a RUNTIME peer (client / react-query),
    not the type source.
  - `gen:flows` reads `../stapel-<mod>/docs/flows.json`; `gen:manifest` reads the
    per-module `docs/schema.json`. Public types are unchanged — the repoint is a
    zero-diff source-swap (byte-identity proven), so no consumer breaks.

  **Wave 3 (version scheme B).** Each pair's minor now tracks its backend minor:
  `auth-react → 0.5.0` (stapel-auth 0.5.x), `notifications-react → 0.3.0`,
  `profiles-react → 0.3.0`, `billing-react → 0.4.0`, `workspaces-react → 0.3.0`.
  `manifest.backend.contract` records the one-minor compatibility window
  (`>=0.5 <0.6` etc.), auto-derived from the backend `pyproject.toml`.

- 4e6f442: Internal plumbing swap (slim wave §21/S2) — the pair's stamped
  `model/runtime.ts` / `model/context.tsx` / `headless/<Mod>Provider.tsx`
  boilerplate (byte-identical across the six standard pairs) now binds
  `@stapel/core`'s `createModuleRuntime` / `createModuleContext` factories
  instead of carrying its own copy. Public API preserved exactly: same exported
  names and signatures (`create<Mod>Runtime`, `<Mod>Runtime`,
  `Create<Mod>RuntimeOptions`, `<Mod>RuntimeContext`, `use<Mod>Runtime`,
  `use<Mod>Api`, `use<Mod>Analytics`, `<Mod>Provider>`), same guard-hook error
  messages. No behavior change.
- c3482e7: README wave (slim wave §21/S4): every pair now documents its setup — a new
  Install + "Wire the app once" section built on core's `<StapelProvider>`
  (previously only auth-react's README showed any wiring, as a 5-level provider
  nest). auth-react's wiring example moves to the one-provider shape with the
  `queryRuntime`/`i18n` escape hatches spelled out.
- d3232a9: Zero-flow scaffolding removed (slim wave §21/S3). These six backends annotate
  no `@flow_step`, so `gen:flows` now skips emission for them and the pair's
  `src/flows/generated/` files are gone. The public flow surface is preserved
  exactly by a tiny hand-written shim (`src/flows/registry.ts`): `<MOD>_FLOWS`
  (still `{}`), `<Mod>FlowId`/`<Mod>FlowSpec` (still `never`), `FlowEndpoint`,
  and `flowEndpoints` keep their names, types, and behavior. `toFlowError` and
  the core flow-machine re-exports are untouched. No public-surface delta; the
  generated registry returns automatically once the backend documents its first
  flow.

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
