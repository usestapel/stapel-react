---
"@stapel/auth-react": patch
"@stapel/profiles-react": patch
"@stapel/notifications-react": patch
"@stapel/billing-react": patch
"@stapel/workspaces-react": patch
"@stapel/calendar-react": patch
"@stapel/recordings-react": patch
---

README wave (slim wave §21/S4): every pair now documents its setup — a new
Install + "Wire the app once" section built on core's `<StapelProvider>`
(previously only auth-react's README showed any wiring, as a 5-level provider
nest). auth-react's wiring example moves to the one-provider shape with the
`queryRuntime`/`i18n` escape hatches spelled out.
