# @stapel/profiles-react

## 0.20.0

### Minor Changes

- 57bd738: Visual pass 3: delete the legacy harness stories, and fix the defects the new skins shipped with.

  **The six `state.step` demos are gone.** `my-profile`, `connection-list`,
  `notification-preferences`, `relationship`, `initial-setup` and
  `profiles-provider` rendered a debug card — a component class name, a step chip
  and a row of naked buttons — beside the real skin of the same component, so the
  showcase told two stories about every screen and one of them was the render
  bench (§54 / VC-A1). The headless components they stood for are covered by the
  screens that USE them (`covers:` on the skin demos), which is what the
  completeness gate was always asking for. The demo harness is now the provider
  frame and nothing else.

  **Connections.** The `list-and-row` story mounted a loose `PersonRow` flush
  under a three-row list, so it read as a fourth follower under a heading that
  said three; the two specimens are now separately captioned sections.
  `<ConnectionList/>`'s row control is no longer a solid primary per row — a
  roster line gets a quiet one (`emphasis="row"`) — and on the Followers list the
  offer is "Follow back", because everybody in that list already follows you.

  **Public profile.** The following count was the caller's own-list copy ("31
  people you follow") rendered on somebody else's profile, stating a fact about
  the visitor that was not true; third-person copy (`profiles.public.count.
following`) replaces it. "Rating 4.8" now carries its scale — read-only stars
  plus "4.8 out of 5" — instead of a number that could be out of anything.

  **`<Relationship/>` carries its own theme.** Mounted standalone (a chat header,
  a review byline) it fell back to antd's stock palette and drew Follow in iOS
  blue beside the same component rendering brand indigo one story over. It now
  establishes a `bare` `SkinTheme`, so one accent everywhere.

  **First run stops clipping.** The action row moved out of the sheet's scrolling
  body into `SkinDialog`'s `footer`, which antd pins outside it: at 390px the
  sheet used to cut off at "App language" with Continue below an invisible fold.

  **Settings.** One label anatomy across the screen (`SettingRow`, extracted to
  `src/default/parts.tsx` — dark and muted labels alternated inside one card);
  the display-name edit affordance is a full-height row button named "Edit
  Display name" instead of a 14px pencil named after the field; the `Segmented`
  track is painted from `surface-sunken` so the control has the same anatomy in
  light as in dark; the notification matrix puts each switch against its own
  label instead of ~250px away across a grid cell; and the settings, connections
  and public-profile columns are centred, so a wide canvas is no longer 65% dead
  space beside a left-pinned card.

  New i18n keys (en + ru + es): `profiles.relationship.follow_back`,
  `profiles.public.count.following` (plural family), `profiles.public.
rating_value`, `profiles.settings.field.edit`.

## 0.19.0

### Minor Changes

- 80617e9: The social half of the pair ships: default skins, routes, and an identity layer.

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

- 95e8eec: Both dialogs are bottom sheets on a phone, an unchanged field cannot fire a
  write, and a failed preferences read no longer renders live switches.

  `InitialSetupModal` and `ProfileSettings`' field editor render through
  `@stapel/tokens-antd/skin`'s `SkinDialog`; the hand-rolled
  `isPhone ? <Drawer> : <Modal>` branch is gone. Blocking first-run mode passes
  `dismissible={false}`, so it draws no way out at all rather than a ✕ that is
  offered and inert.

  `EditableTextRow`'s Save was enabled when the draft equalled the stored value —
  a PATCH that changes nothing — and the dialog's dismissal was keyed on that same
  equality, which is already true the instant it opens and which also closed this
  row's dialog when a SIBLING row saved. Save is disabled on an unchanged draft,
  and dismissal now waits for this row's own write to land.

  `NotificationPreferences` rendered its switch matrix out of a defaults-shaped
  read, so a FAILED read drew four live switches at defaults and flipping one
  wrote a preference derived from state nobody could read. The failed arm renders
  the failure and a retry, and no switch. The headless bag gained `state` and
  `refetch` to make that possible — the previous `isError` folded read and write
  together, so a failed toggle would have blanked a screen that is still usable.

## 0.18.2

### Patch Changes

- Raise the peer floors that understated what these packages import.

  `docs-react` and `profiles-react` both call `resolveThemeMode`, which
  `@stapel/tokens-antd` did not export until 0.5.0, while declaring `>=0.2.0`;
  `profiles-react` also imports `Image` and `StapelImage` from `@stapel/image`,
  which first shipped them in 0.2.0, while declaring `>=0.1.0`. A consumer
  installing at the declared floor got an unresolvable import.

  `check:peer-floors` now checks every `@stapel/*` peer instead of only
  `@stapel/core`, and refuses to run against a checkout with no tags — where it
  previously answered "unknown" for every symbol and passed each package
  unchecked.

## 0.18.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.18.0

### Minor Changes

- 400f9e6: A read that failed no longer renders as a read that came back empty: `ConnectionList`'s bag hands out `state: LoadState<readonly string[]>` (plus a `count` that is `undefined` until the read lands) instead of a pre-flattened `ids`/`isLoading`/`isError`/`error`, and the `LanguageSettings`, `ProfileSettings` and `InitialSetupModal` skins render their catalogue/field-manifest lists through `matchList` — a failed language catalogue now shows the failure and a retry instead of degrading the picker to a single raw language code and deleting the "languages you understand" block.

  `InitialSetupModal`'s Save no longer greys out without saying why: the blank-display-name case states its reason as visible text through `useActionGate` (new key `profiles.initialSetup.blocked.name_required`), while the in-flight save keeps its plain spinner-disable.

## 0.17.0

### Minor Changes

- a5b8faa: Spanish ships as a locale of the pairs: the `./i18n/es` subpath

  Each of these five pairs gains a generated Spanish error bundle
  (`src/i18n/generated/errors.es.gen.ts`) and the `@stapel/<pair>/i18n/es` subpath
  that makes it reachable — `registerXI18nEs(engine)`, mirroring the existing `ru`
  contour. Key counts, complete over each backend's error registry by
  construction: auth 127, workspaces 67, profiles 53, billing 53,
  notifications 43.

  **Declared coverage — read this before adopting.** The `es` bundle translates
  the BACKEND ERROR CODES only. The pairs' own UI copy (`AUTH_I18N_KEYS` and its
  siblings) has no hand-written Spanish yet, and `registerXI18nEs` deliberately
  registers the en floor UNDERNEATH the Spanish texts, so those keys resolve to
  their English text — never to a raw key. A Spanish-speaking user therefore reads
  Spanish error messages and English UI copy. That boundary is asserted in each
  pair's `test/i18nEs.test.ts`, not left to be discovered. Hand-written Spanish UI
  copy lands later, additively: the subpath and the `xI18nBundleEs` export keep
  their names and shapes when it does.

  The locale stays out of the main entry (size-limit budget per subpath + a
  module-graph purity test), so hosts that never register it carry none of it.

  Regenerated against bumped contract pins — auth v0.20.1, notifications v0.7.1,
  billing v0.6.1, workspaces v0.22.1 (profiles was already pinned at v0.12.0,
  which already carried its catalogue). Besides the catalogues, those pins bring:

  - **auth** — two new error codes, `error.403.privileged_account` and
    `error.403.registration_closed`; and the OTP `code` field's documented length
    goes 4 → 8 digits across the password/TOTP/disable-otp request bodies. In the
    emitted TypeScript this is a doc-comment change only (`maxLength` is a runtime
    validation, not a TS type), so no generated type moved.
  - **workspaces** — one new error code, `error.503.profiles_not_configured`: the
    deployment-has-no-profiles-service half of the member-rename 503, distinct
    from `error.503.profiles_unavailable` (the call was made and failed).
  - **notifications** — the push-token register/unregister permission is restated
    as `IsNotAnonymousUser`; OpenAPI description prose only.
  - **billing** — nothing but the catalogue and the backend-version pin.

  No path, method, field or type was added, removed or retyped in any pair's
  generated `schema.ts`. `calendar-react` and `recordings-react` are deliberately
  untouched: `stapel-calendar` and `stapel-recordings` ship no locale catalogues at
  all (they have no Russian either), and a fabricated empty Spanish file would only
  make the set look uniform.

## 0.16.0

### Minor Changes

- c5c0a11: Default skins render the error surface through core's split copy: the human
  sentence as the alert's message, and the technical detail (`HTTP 500`) as a
  muted, small description beside it instead of a protocol number spliced into
  the sentence. Requires `@stapel/core >= 0.12.0`.

## 0.15.0

### Minor Changes

- e2e932d: fix(profiles-react): an uploaded avatar carries its own provenance

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

### Patch Changes

- 3ac8297: fix: the error surface a 500 puts on screen — readable, and in the user's language

  Two defects an owner hit behind a backend 500 on a live sandbox, both fixed at
  their root rather than at the one alert that showed them.

  **The alert was unreadable on a dark deployment.** `@stapel/tokens-antd`'s
  `readLiveCssVar` served the host's LIVE `--stapel-*` custom properties for
  whatever mode the caller asked for — but those properties resolve through the
  document's active `data-theme`, so they are the DOCUMENT's mode, not the
  caller's. A default skin defaulting `mode` to `"light"` inside
  `<html data-theme="dark">` therefore got antd's LIGHT algorithm (deriving
  `--ant-color-error-bg: #fff2f0`, near-white) welded to a LIVE DARK
  `--ant-color-text: #f4f5f7` — measured 1.00:1 contrast.

  - `resolveThemeMode()` (new export) reads the same `data-theme` attribute
    `@stapel/tokens`' `tokens.css` keys its dark block on. `mode` is now optional
    on `toAntdTheme`/`toAntdThemeConfig` and defaults to it.
  - `readLiveCssVar` serves a live value only when the document is in the mode
    being asked for; otherwise the compiled-in default for the REQUESTED mode.
    The bridge can no longer emit a blended theme.
  - Every `@stapel/profiles-react` default skin defaults `mode` to
    `resolveThemeMode()` instead of `"light"`, so it self-themes with no host
    wiring. Pass `mode` explicitly to pin a side.

  **The alert showed `Request failed with status 500`.** That is
  `parseErrorEnvelope`'s own diagnostic for a response with no error envelope (a
  Django 500 under `DEBUG=False` returns HTML) — the HTTP client's internals, in
  English, on a Russian UI. The one-dialect machinery existed but had no rung a
  query/mutation-driven skin could reach, and no catalogue behind the codes core
  itself mints.

  - `@stapel/core` now ships an error FLOOR (`stapel.http.*`,
    `stapel.transport.failed`, `stapel.error.unknown`) in en and ru, seeded by
    `createI18n` under every locale before any caller bundle — a host wires
    nothing, and any pair or host bundle registered later still wins the key.
  - `useErrorText()` (new export) folds ANY thrown value into that dialect in one
    call, which is what a skin holding `error: unknown` needed.
  - `formatFlowError` exposes the error's HTTP `{status}` to templates and widens
    core's OWN `stapel.http.<status>` codes to a class-wide `stapel.http.5xx`
    entry. Real backend codes are never widened — two different 404s stay two
    different states.
  - Default skins across profiles-react, auth-react, notifications-react and
    workspaces-react now render `useErrorText(...)` instead of `error.message`.

## 0.14.0

### Minor Changes

- f9c04aa: Ручки вчерашних релизов бэкенда стали вызываемыми с фронта.

  `@stapel/workspaces-react` (контракт stapel-workspaces `>=0.14 <0.15`):

  - `useInvitations` / `useInfiniteInvitations` — админская таблица приглашений
    (`GET /{ws}/invitations`) с фильтрами `status` (`pending` / `never_accepted`
    / `all`) и `search`. Пагинация **якорная**, как у `useMembers`: страница
    адресуется непрозрачным `next_anchor` предыдущей, номера страницы нет —
    оффсет поехал бы ровно в тот момент, когда приглашение отзывают у админа
    под руками.
  - `useRevokeInvitation` / `useResendInvitation` — отзыв и повторная отправка;
    обе возвращают обновлённый DTO. Ресенд ротирует токен и перезапускает TTL,
    поэтому таблица инвалидируется: старый `expires_at` на экране врал бы про
    живую креденцию.
  - `useResetMemberPassword` — админский сброс пароля участнику.
    `generated_password` приходит ровно один раз и **не попадает в кэш
    запросов** (ничего не пишется через `setQueryData`, `gcTime: 0`): рантайм
    ядра персистит весь пользовательский query-кэш в localStorage, так что
    запись туда означала бы живой пароль на диске и в девтулзах.
  - `useCapabilityGate` + порт `BUILTIN_CAPABILITY_LEVELS` — уровень `high` и
    скоуп `sensitive` известны **до** кнопки, а не после 403.
    `readVerificationEnrollment` отличает конверт «заведи фактор» (его ядро не
    перехватывает — перехватывать нечего) от обычного челленджа.
  - `useUpdateSecuritySettings` — `provisioned_user_policies` теперь список
    независимых требований (#90), пустой список отправляется явно. Мердж
    делается на клиенте: бэкенд присваивает `settings` целиком, и голый
    `{security: …}` стёр бы остальные ключи.

  `@stapel/profiles-react` (контракт stapel-profiles `>=0.9 <0.10`):

  - `useProfilesBatch` — `POST /profiles/api/v1/batch`, один запрос вместо N.
    `profileBatchEntry` отвечает четырьмя состояниями (`found` / `missing` /
    `not_requested` / `unknown`): «профиля нет» — нормальное состояние и
    плейсхолдер, «не спрашивали» — другое дело, и схлопывать их в `undefined`
    значило бы вернуть тот самый дефект, ради которого батч и делался.
    Найденные профили засеваются в кэш `useProfile`; для `missing` не
    выдумывается ничего.

## 0.13.0

### Minor Changes

- 75f5d5f: `useAvatarUpload` no longer lies about its error. `catch (e) { setError(e as
StapelApiError) }` typed EVERY failure as a Stapel error — a network fault, an
  origin answering HTML, a transport rethrowing the raw envelope all landed in
  `error` with `undefined` for `.code`/`.status` at runtime, so a consumer's
  `error.code`-driven message silently rendered nothing. It now folds through
  `toStapelApiError(e)`, so `error` is always a real `StapelApiError`: a genuine
  backend envelope keeps its code/status, and a transport fault gets
  `stapel.transport.failed` + status `0` instead of a fabricated shape. The
  `AvatarUploadBag.error` type (`StapelApiError | null`) is unchanged.

  Requires the fold, so the `@stapel/core` peer floor moves to `>=0.9.0 <1.0.0`.

## 0.12.0

### Minor Changes

- d947262: `/default` skin (`InitialSetupModal`, `ProfileSettings`, `LanguageSettings`, `NotificationPreferences`) now self-themes: each takes a `mode?: "light" | "dark"` prop and wraps its output in `<ConfigProvider theme={toAntdThemeConfig(mode)}>`, the same contract `AuthPanel` already ships — a host importing this pair's default skin no longer needs its own `ConfigProvider`/`toAntdThemeConfig` wrapper to get an on-brand result; it was rendering raw antd defaults before. Adds `@stapel/tokens-antd` as an optional peer dependency.

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
