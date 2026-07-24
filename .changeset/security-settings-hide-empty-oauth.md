---
"@stapel/auth-react": minor
---

`<SecuritySettings/>` now hides the whole "Connected accounts" group when the deployment has no OAuth providers configured (`capabilities.registration.oauth` empty) instead of showing the group's heading over `<OAuthLinks/>`'s empty-state card ("No providers configured.") — dead chrome for an end user on a deployment that never wired OAuth. Standalone `<OAuthLinks/>` usage is unchanged (its own empty state is still there for hosts that render it outside `SecuritySettings`).
