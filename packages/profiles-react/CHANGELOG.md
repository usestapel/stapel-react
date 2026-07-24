# @stapel/profiles-react

## 0.11.0

### Minor Changes

- f2654cf: InitialSetupPrompt canon (workspaces-org-program §B5) — the ironmemo onboarding modal ported into the pair as the display-name/first-run prompt every host reuses:

  - Headless `InitialSetupPrompt`: render-prop bag over the pair's existing `useMyProfile`/`useUpdateMyProfile` — first-run fields `displayName`/`theme`/`language` (each `{enabled, value, set, save}`, host-selectable via `fields`, default all three), `submit(extra?)` PATCHes `{display_name, theme, app_language, initial_setup_passed: true}` in one request through `ProfileUpdate`'s open envelope, `skip()` records "maybe later" (no PATCH).
  - `useInitialSetupGate({ mode: "always" | "daily", require: "displayName" | "initialSetup" })` → `{shouldShow, dismiss}`: `displayName` fires on a blank display name (meettoday's blocking join-a-call case, ex-`GuestNameModal`), `initialSetup` on `initial_setup_passed !== true`; `daily` rate-limits to once per 24h via the canonical stamp `stapel.profiles.initialSetup.lastPromptAt` persisted through `@stapel/core`'s `createRepository` (scope `app`, localStorage), stamped at show-time; `always` never rate-limits. Built on the session-ready-gated `useMyProfile`, so the gate can't fire pre-session.
  - Default skin `InitialSetupModal` (`/default`, antd): display-name input, the exact `<ProfileSettings/>` theme Segmented row (same i18n keys), app-language select from `useLanguages`; `skippable` (default true) — `false` is the blocking mode (no Skip, no ✕/Esc/mask).
  - i18n: new `profiles.initialSetup.*` keys (title/subtitle/name_placeholder/save/saving/skip), en + ru, texts ported from ironmemo.

## 0.10.0

### Minor Changes

- 5c33c23: `<ProfileSettings/>`: render the hard-core `display_name` + `theme` rows itself (stapel-profiles ≥0.7.0 moved them back into `ProfileCore`, so they never appear in `GET /field-manifest`). Both rows follow the settings-interaction canon (editable-text dialog for the name, reactive `Segmented` for the theme) with new pair-owned i18n keys (`profiles.settings.field.*`, `profiles.settings.theme.*`, en+ru). Owner canon "даже в дефолт скине должна быть возможность их кастомизировать или отключить": new props `showDisplayName`/`showTheme` (default `true`) turn a row off, `displayNameRow`/`themeRow` replace it with a host node. Manifest entries named `display_name`/`theme` from a pre-0.7.0 backend are deduped so a stale registry never renders a second row.

## 0.9.0

### Minor Changes

- 2ab4091: Avatar now renders through `<Image>` from `@stapel/image`, driven by the backend's `avatar_image` descriptor.

  `ProfileSettings` reads the source-agnostic `StapelImage` that stapel-profiles ≥0.6.0 denormalizes onto `/me` (`avatar_image`), and renders it with `<Image>` — the right ladder tier picked from the measured slot × DPR × aspect, plus blur-up — for a CDN / plain-file / external-link avatar alike. A fresh upload still shows its local preview immediately; the `avatarUrlFor` host hook stays as a deprecated fallback for hosts that haven't upgraded the backend. Adds `@stapel/image` as a peer dependency. Pin bumped to stapel-profiles v0.6.0 with the API client regenerated in the same change.

## 0.8.0

### Minor Changes

- cff85d2: `useMyProfile` is now cache-first / stale-while-revalidate: `staleTime: 0` makes it unconditionally revalidate on every mount via TanStack Query's default `refetchOnMount`, regardless of how fresh a hydrated snapshot looks. Pair it with `@stapel/core`'s new `createMeCachePersister` — wire `<StapelProvider meCacheQueryKeys={[profilesQueryKeys.me()]}>` — and a cold load paints the last-known profile instantly from `localStorage`, then updates once the network responds. No wiring, no persister: behavior is unchanged (a normal fetch-on-mount query).

## 0.7.0

### Minor Changes

- c88b66c: Add this pair's nav-manifest entry (`src/nav/manifest.ts`, `profiles.settings` — the top-level entry other pairs' submenu entries nest under, e.g. auth-react's `auth.security`) for the scripted-fullstack navigation contract. New i18n key `profiles.nav.settings` (en + ru).

## 0.6.0

### Minor Changes

- 784cb9f: **BREAKING (default skin only):** `<ProfileSettings/>` (`@stapel/profiles-react/default`) is now data-driven, per `stapel-profiles` 0.5.0's field-constructor cut (`docs/pending/profile-fields.md`, "Дополнение владельца" §1 — the two-tier front-pair answer). The hardcoded display-name/currency/theme/units fields are gone; the skin now renders one row per entry of the new `GET /field-manifest` endpoint, widget picked by `entry.kind`:

  - `text` (and `geohash`) → read-only + pencil → Modal (desktop) / Drawer (phone) to edit, same interaction canon as before.
  - `bool` → a reactive `Switch`.
  - `enum` → a reactive `Segmented` for ≤4 choices, else a `Select`.
  - `model_ref` → a reactive `Select`; `currency_code` is the only field with a built-in options source today (`stapel-currencies` is a live catalog, not a fixed enum) — an unrecognized `model_ref` falls back to a text edit rather than disappearing.
  - `geohash` is hidden unless the new `showGeohash` prop opts in.

  The `showUnits` prop is REMOVED (measurement units left the hard `Profile` model entirely in stapel-profiles 0.5.0 — it's a `STANDARD_FIELDS` pick now, reflected automatically if a project's manifest selects it).

  New surface: `useProfileFieldManifest()` (GET `/field-manifest`, public — no session gate), plus the `ProfileFieldManifestEntry`/`ProfileFieldKind` types and `ProfilesApi.getFieldManifest()`. `MyProfile`/`ProfileUpdate` are now OPEN envelopes (`& Record<string, unknown>`) — a project's swapped Profile model can carry identity/standard/custom fields this pair's own generated schema never declares, and the data-driven skin (or any host code) can read/write them by name with no cast.

  Regenerated `api/generated/schema.ts` from stapel-profiles 0.5.0's `docs/schema.json` (the field-manifest response shape + the core `Profile` cut).

## 0.5.0

### Minor Changes

- 6ef6c44: Owner UX audit of the default settings skins (2026-07-17):

  - **Interaction canon** (codified in `docs/pending/frontend-guidelines.md`
    §8 "Интеракции настроек"): `ProfileSettings`/`LanguageSettings` no longer
    have a single "Save changes" button batching several fields into one PATCH.
    Every picker (currency/theme/language/units) applies REACTIVELY on
    `onChange` — `useUpdateMyProfile` is now itself optimistic (the cache
    updates before the round trip lands, via a new `onMutate`/`onError` pair)
    and rolls back visibly on failure. Display name is now a read-only row with
    an edit (pencil) affordance that opens a `Modal` (desktop) / bottom
    `Drawer` (phone) to edit + save, instead of a bare inline `Input`.
  - **Units removed from the default render** (`ProfileSettings`): measurement
    units only matter to convertible catalog attributes, not a personal
    profile screen. The field stays fully supported in the backend contract
    (`measurement_units` via `useMyProfile`/`useUpdateMyProfile`); pass the new
    `showUnits` prop to opt back into rendering it here.
  - **Language picker**: "Auto" is now the FIRST item of the app-language
    `Select` itself (picking it PATCHes `use_device_language: true`) instead of
    a separate switch next to the picker — and the picker's option list truly
    reflects whatever `GET /languages/` returns (see `stapel-profiles`'s own
    release for the backend half of this fix).
  - Fixed a developer-facing string: the language-settings subtitle no longer
    mentions `stapel-translate` by name (now reads as plain user copy in both
    `en` and `ru`).

## 0.4.0

### Minor Changes

- f15c6be: Add the pair's first `/default` settings skin: `ProfileSettings` (display name, avatar, currency/units/theme), `LanguageSettings` (app language, use-device-language, understood languages), and `NotificationPreferences` (a category × channel matrix over the caller's `email_messages`/`email_system`/`push_messages`/`push_system` fields — modeled headlessly as a 2×2 matrix rather than four flat booleans, so a future backend category is one more row, not a new component).

  Also ships a documented avatar-upload stopgap (`useAvatarUpload`, headless) that calls stapel-cdn's `POST /upload/avatar/` directly through core's client-injection seam (`useStapelClient("cdn")`) — no `@stapel/cdn-react` pair exists yet to own that contract; delete this hook once one ships.

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
