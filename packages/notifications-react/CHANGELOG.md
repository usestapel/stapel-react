# @stapel/notifications-react

## 0.9.0

### Minor Changes

- 400f9e6: Headless bags hand out a `LoadState` instead of a flattened array, so a failed
  read can no longer be mistaken for an empty one: `DocumentListBag`,
  `FolderTreeBag`, `BreadcrumbsBag`, `RevisionHistoryBag`, `TrashBag`,
  `MediaViewerBag` and `NotificationFeedBag` expose `state` (plus `urlState` on
  the media bag) and drop their `isLoading`/`isError`/`error` read fields; the
  default skins render through `matchList`/`matchLoad`, so the empty state is
  reachable only from a load that actually succeeded.

  Controls that switch off because a read failed now say why: "Empty trash"
  (`TrashPane`) and the download button (`FileCard`) go through
  `useActionGate` and render the reason as text beside the control.

## 0.8.0

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

## 0.7.0

### Minor Changes

- c5c0a11: Default skins render the error surface through core's split copy: the human
  sentence as the alert's message, and the technical detail (`HTTP 500`) as a
  muted, small description beside it instead of a protocol number spliced into
  the sentence. Requires `@stapel/core >= 0.12.0`.

## 0.6.1

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

## 0.6.0

### Minor Changes

- 58ea7b5: Add this pair's nav-manifest entry (`src/nav/manifest.ts`, `notifications.feed`) for the scripted-fullstack navigation contract. New i18n key `notifications.nav.feed` (en + ru).

## 0.5.0

### Minor Changes

- 6ef6c44: Gate top-level "the caller's own …" query hooks on `@stapel/core`'s new
  `useActiveSessionReady()` (owner-diagnosed live incident, 2026-07-17): a hook
  with no natural `enabled` condition of its own (`useWorkspaces`, `useWallet`,
  `useTransactions`, `useSubscription`, `useNotificationFeed`/
  `useInfiniteNotificationFeed`, `useCalendar`/`useEvents`/`useAvailability`,
  `useRecordings`) fires the instant a component mounts — which used to race a
  session still bootstrapping and read a live one as "expired". Detail hooks
  keyed by an id (`useWorkspace`/`useMembers`/`useEvent`/`useRecording`) now
  ALSO gate on session readiness in addition to their existing non-empty-id
  check, since an id can be known synchronously (e.g. a URL param) before the
  session settles.

  Deliberately NOT gated: `useCatalog` (billing) and `useLanguages` (profiles,
  unaffected by this changeset but worth noting for symmetry) — both are
  public reference lists a signed-out visitor legitimately needs.

  Zero manual wiring at any call site: `useActiveSessionReady()` reads
  whichever `SessionManager` a session-owning module (e.g.
  `@stapel/auth-react`'s `createAuthRuntime`) registered as "active", and
  defaults to `true` (never blocks) when no such module exists in the host at
  all.

## 0.4.0

### Minor Changes

- f15c6be: Add the pair's first `/default` settings skin: `PushNotificationToggle` (bind/unbind this device's push token — the module has no endpoint to list a caller's already-registered devices, so a persisted multi-device on/off state isn't representable yet) and `NotificationFeedList` (the paginated in-app notification history with load-more). Note: the category × channel notification _preference_ toggles ("email for messages", "push for system alerts") actually live on `Profile`/`ProfileUpdate` in `@stapel/profiles-react`, not on this module — see that pair's new `NotificationPreferences` default skin.

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

- f46666e: Russian locale as an opt-in `@stapel/notifications-react/i18n/ru` subpath
  (i18n-shipping wave 2, following the auth-react etalon — wave 1).

  - `errors.ru.gen.ts` — generated per-locale error bundle, auto-discovered by
    the shared `gen-errors.mjs` driver from stapel-notifications's
    `translations/errors.ru.json` catalog. `pnpm gen:errors:check` remains the
    drift gate; existing en outputs are byte-identical.
  - `@stapel/notifications-react/i18n/ru` — `notificationsI18nBundleRu`
    (generated backend ru + hand-written ru UI copy) and
    `registerNotificationsI18nRu(engine)`, which registers the en floor UNDER
    the ru texts so a missing key degrades to English, never to a raw key. Host
    bundles registered after the pair's win (merge-priority convention, now
    documented on `registerNotificationsI18n`).
  - Tree-shake purity is gated twice: the main-entry size-limit budget is
    unchanged (the ru locale is not in its graph; the ru subpath is its own
    chunk with its own budget) and `test/i18nRu.test.ts` walks the compiled
    `dist/index.js` module graph asserting the ru modules never appear.

- c3acbad: New pair: **`@stapel/notifications-react`** — the headless React pair for
  stapel-notifications, the first pipeline pair scaffolded from the re-etalon
  (`stapel-new-react-lib`, G1–G8) after auth-react.

  - **API layer** — typed operations over the injected `StapelClient`
    (`registerDevice`, `unregisterDevice`, `feed`) with schema aliases from the
    unified OpenAPI (`DeviceTokenResponse`, `FeedItem`, `NotificationFeedPage`)
    and one documented correction (`Platform` narrowed from the schema's bare
    `string` to `"ios" | "android" | "web"`, matching the backend's
    `VALID_PLATFORMS`). The staff-only `/notification-keys/` collector is
    deliberately omitted.
  - **Model hooks** — `useNotificationFeed` (single page) and
    `useInfiniteNotificationFeed` (anchor-paginated load-more) reads;
    `useRegisterDevice` / `useUnregisterDevice` writes. Query keys come from the
    namespaced `notificationsQueryKeys` factory.
  - **Headless components** — `NotificationFeed` and `DeviceRegistration`
    (renderless render-prop bags), plus the scaffold's `NotificationsProvider`.
    Every headless export is covered by a demo (completeness gate green).
  - **i18n** — English fallback bundle for the pair's UI keys plus the generated
    backend error bundle (43 keys from stapel-notifications `docs/errors.json`,
    each with a `remediation` hint). 0 flows — notifications annotates no
    `@flow_step`, which the zero-flow codegen handles as a valid empty registry.
  - **Tests** — happy-path hook + headless render tests (feed pagination, device
    registration, and a localizable-error path over msw), the generated
    errors-bundle and demo-smoke families, and the prod-bundle-purity gate.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
