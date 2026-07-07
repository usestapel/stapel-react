# @stapel/notifications-react

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
