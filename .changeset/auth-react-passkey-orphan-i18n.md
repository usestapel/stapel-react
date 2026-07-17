---
"@stapel/auth-react": patch
---

Removes four orphaned i18n keys (`secPasskeysAddTitle`/`secPasskeysNameLabel`/`secPasskeysNamePlaceholder`/`secPasskeysBeginCta`) left over from a passkey-registration modal that no longer exists in `<PasskeysManager/>` — dead keys with no reader, in both the `en` bundle (`i18n/keys.ts`) and the `ru` bundle (`i18n/ru.ts`).
