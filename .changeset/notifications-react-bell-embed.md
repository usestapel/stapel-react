---
"@stapel/notifications-react": minor
---

The nav manifest now offers `NotificationBell` as an embed: `notifications.bell` in the `topbar.end` slot, for members, opening the `notifications.feed` entry. A scaffold that reads `nav-manifest.json` can place the bell in the shell's top bar without hand-written chrome.

The `@stapel/core` peer floor rises to `>=0.30.0`, the release that ships the slot types this package now imports.
