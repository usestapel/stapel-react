---
"@stapel/notifications-react": minor
---

Add the pair's first `/default` settings skin: `PushNotificationToggle` (bind/unbind this device's push token — the module has no endpoint to list a caller's already-registered devices, so a persisted multi-device on/off state isn't representable yet) and `NotificationFeedList` (the paginated in-app notification history with load-more). Note: the category × channel notification *preference* toggles ("email for messages", "push for system alerts") actually live on `Profile`/`ProfileUpdate` in `@stapel/profiles-react`, not on this module — see that pair's new `NotificationPreferences` default skin.
