---
"@stapel/profiles-react": minor
---

InitialSetupPrompt canon (workspaces-org-program §B5) — the ironmemo onboarding modal ported into the pair as the display-name/first-run prompt every host reuses:

- Headless `InitialSetupPrompt`: render-prop bag over the pair's existing `useMyProfile`/`useUpdateMyProfile` — first-run fields `displayName`/`theme`/`language` (each `{enabled, value, set, save}`, host-selectable via `fields`, default all three), `submit(extra?)` PATCHes `{display_name, theme, app_language, initial_setup_passed: true}` in one request through `ProfileUpdate`'s open envelope, `skip()` records "maybe later" (no PATCH).
- `useInitialSetupGate({ mode: "always" | "daily", require: "displayName" | "initialSetup" })` → `{shouldShow, dismiss}`: `displayName` fires on a blank display name (meettoday's blocking join-a-call case, ex-`GuestNameModal`), `initialSetup` on `initial_setup_passed !== true`; `daily` rate-limits to once per 24h via the canonical stamp `stapel.profiles.initialSetup.lastPromptAt` persisted through `@stapel/core`'s `createRepository` (scope `app`, localStorage), stamped at show-time; `always` never rate-limits. Built on the session-ready-gated `useMyProfile`, so the gate can't fire pre-session.
- Default skin `InitialSetupModal` (`/default`, antd): display-name input, the exact `<ProfileSettings/>` theme Segmented row (same i18n keys), app-language select from `useLanguages`; `skippable` (default true) — `false` is the blocking mode (no Skip, no ✕/Esc/mask).
- i18n: new `profiles.initialSetup.*` keys (title/subtitle/name_placeholder/save/saving/skip), en + ru, texts ported from ironmemo.
