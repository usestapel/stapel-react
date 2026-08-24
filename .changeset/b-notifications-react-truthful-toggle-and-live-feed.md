---
"@stapel/notifications-react": minor
---

The push toggle stops lying and the feed stops being a log.

Against **stapel-notifications 0.17.0** (`GET /devices/`, `DELETE /devices/by-id/{id}/`, the `notifications:user:<id>` stream). Pre-1.0, so the shape changes below are a minor.

- **The switch draws the server's answer.** `PushNotificationToggle` had a `useState(false)`: it rendered OFF on every mount whether or not this device was receiving push, and after a reload it held no token, so turning it OFF sent **no request at all** while telling the person push was disabled — the server kept sending. `DeviceRegistration` now derives one `PushState` (`on`/`off`/`inactive`/`unknown`/`denied`/`unsupported`/`loading`/`failed`) from `GET /devices/` matched on SHA-256 of the token this device holds (`currentToken`, a new optional prop that must not prompt). There is no boolean to flip: a failed registration leaves the switch where it was, a refused permission prompt is a visible sentence instead of a swallowed rejection, and a device we cannot identify says so and gates the control rather than no-op'ing.
- **`PushDeviceList` / `PushSettingsPane`** — new default skins over the registry: every device the account sends to, this one marked, a provider-rejected token flagged rather than hidden, and removal by row id behind `SkinConfirm` (a bottom sheet on a phone).
- **The feed renders all six wire fields.** Type glyph per family, title, one-line body, relative time in a `<time>` carrying the exact instant, and the whole row as a link when `data` carries `listing_url` / `chat_url` / `notifications_chat_url`. "You're all caught up" is a footnote under rows again; the empty state stands alone.
- **Live feed, and the polling policy said out loud.** `@stapel/notifications-react/live` (`<NotificationsLive userId>`) consumes `@stapel/realtime`'s `useStream` on `notifications:user:<id>` and merges arriving rows into the feed cache by id. With no socket the newest page is refetched every 60s **while the tab is visible and never while it is hidden**, plus on focus — the backend's own interval, not a guess. Either way `useFeedDelivery()` reports the mode and the skin draws it: `live`, `connecting`, `reconnecting`, a NAMED refusal with Reconnect, or `polling`. Never a silent degradation.
- **`NotificationsPage`** — the nav's top-level bell now opens a page instead of a 340px settings card, and a second `submenu` entry under `profiles.settings` routes `PushSettingsPane`.
- **es reaches parity.** The Spanish bundle carried zero pair-owned UI keys (Spanish errors inside an English screen); every key now has es and ru copy, asserted per key.
- Adopts the shared substrate: local `ErrorAlert.tsx` deleted, `SkinTheme`/`LoadList`/`EmptyState`/`ErrorAlert`/`GatedControl`/`SkinConfirm` from `@stapel/tokens-antd/skin`, spacing from `@stapel/tokens` (0 raw dimensions), aria-labelled switch, element-width geometry.
- New: `useDevices`, `useUnregisterDeviceById`, `notificationsQueryKeys.devices()`, `feedItemLink`, `tokenFingerprint`, `formatFeedTime`/`formatDateTime`. Renamed: `feedSettingsTitle`/`feedSettingsSubtitle` → `feedTitle`/`feedSubtitle`; `feedRetry` dropped (the substrate's floor owns "Try again"); `deviceRegister`/`deviceUnregister`/`deviceRegistering`/`deviceRegistered` replaced by the `notifications.push.*` state keys.

Peers: `@stapel/core >=0.18.0`, `@stapel/tokens-antd >=0.6.0` (optional), `@stapel/realtime >=0.1.0` (optional — only the `/live` subpath imports it).
