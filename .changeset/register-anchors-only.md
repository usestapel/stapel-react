---
"@stapel/auth-react": minor
---

Registration surface — identity model, now configurable.

- `<AuthPanel variant="register"/>` renders ONLY verified identity anchors by default — email/phone/oauth/sso. Password is a credential, not an anchor: setting one does not create an identity (it only makes a guest account portable), so it no longer appears on the "create an account" screen even if the backend sends `can_register: true` for it. Fixes the wrong-model behaviour where password leaked onto the register surface.
- New configurable seam: `enabledRegistrationChannels(methods, priority, anchors)` takes an anchor set, and `<AuthPanel>` gains a `registrationAnchors` prop (defaulting to the exported `REGISTRATION_ANCHORS`). A deployment that deliberately wants classic login/password accounts ("90s-style" — password IS the account and deanonymizes) opts password in via this prop, wired from its app env, paired with the backend's new `AUTH_PASSWORD_DEANONYMIZES=True`. `REGISTRATION_ANCHORS` is now exported from `@stapel/auth-react/default`.
- Regenerated the error i18n bundle from the current stapel-auth contract (adds `totp_proof_required`, `totp_not_enabled` and other keys the committed bundle had drifted behind).
