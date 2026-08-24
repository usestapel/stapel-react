---
"@stapel/core": minor
---

The runtime half of the shared skin substrate: a UI floor in three locales, a synchronous `useBreakpoint`, a slot placeholder, and an optional i18n seam.

- **UI floor (`stapel.ui.*`, en/ru/es)** — `STAPEL_UI_KEYS` (retry, dismiss, confirm, cancel, loading, the empty-state title, the unfilled-slot sentence), seeded by `createI18n` under every locale exactly like the error floor, so `@stapel/tokens-antd/skin` renders a real sentence with zero host wiring and a host overrides any key by registering it later. The error floor gains **`es`** alongside `en`/`ru`; `CORE_ERROR_LOCALES` now lists all three.
- **`useBreakpoint()` is right on the first client render.** It reads through `useSyncExternalStore` (window width, subscribed to `resize` and to the two breakpoint media queries) instead of an effect, so `AppShell`/`PublicShell` no longer paint the phone drawer on a desktop for one frame. `undefined` is returned only on the server and the hydration pass that must agree with it. The return type is unchanged.
- **`SlotPlaceholder`** — an unfilled render slot renders a visible, named, dashed box in development and nothing in production, never silent nothing. Design-system-free (tokens custom properties only) so the headless layer that declares a slot can stand in for it. `isDevBuild()` is the switch, readable by anyone.
- **`useOptionalI18n()`** — the nearest engine or `null`, for a component that owns its copy props and merely floors them when a host is present.
