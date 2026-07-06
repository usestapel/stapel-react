---
"@stapel/notifications-react": minor
---

New pair: **`@stapel/notifications-react`** — the headless React pair for
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
