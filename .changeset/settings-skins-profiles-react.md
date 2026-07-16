---
"@stapel/profiles-react": minor
---

Add the pair's first `/default` settings skin: `ProfileSettings` (display name, avatar, currency/units/theme), `LanguageSettings` (app language, use-device-language, understood languages), and `NotificationPreferences` (a category × channel matrix over the caller's `email_messages`/`email_system`/`push_messages`/`push_system` fields — modeled headlessly as a 2×2 matrix rather than four flat booleans, so a future backend category is one more row, not a new component).

Also ships a documented avatar-upload stopgap (`useAvatarUpload`, headless) that calls stapel-cdn's `POST /upload/avatar/` directly through core's client-injection seam (`useStapelClient("cdn")`) — no `@stapel/cdn-react` pair exists yet to own that contract; delete this hook once one ships.
