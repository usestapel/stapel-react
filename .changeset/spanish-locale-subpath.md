---
"@stapel/auth-react": minor
"@stapel/billing-react": minor
"@stapel/notifications-react": minor
"@stapel/profiles-react": minor
"@stapel/workspaces-react": minor
---

Spanish ships as a locale of the pairs: the `./i18n/es` subpath

Each of these five pairs gains a generated Spanish error bundle
(`src/i18n/generated/errors.es.gen.ts`) and the `@stapel/<pair>/i18n/es` subpath
that makes it reachable — `registerXI18nEs(engine)`, mirroring the existing `ru`
contour. Key counts, complete over each backend's error registry by
construction: auth 127, workspaces 67, profiles 53, billing 53,
notifications 43.

**Declared coverage — read this before adopting.** The `es` bundle translates
the BACKEND ERROR CODES only. The pairs' own UI copy (`AUTH_I18N_KEYS` and its
siblings) has no hand-written Spanish yet, and `registerXI18nEs` deliberately
registers the en floor UNDERNEATH the Spanish texts, so those keys resolve to
their English text — never to a raw key. A Spanish-speaking user therefore reads
Spanish error messages and English UI copy. That boundary is asserted in each
pair's `test/i18nEs.test.ts`, not left to be discovered. Hand-written Spanish UI
copy lands later, additively: the subpath and the `xI18nBundleEs` export keep
their names and shapes when it does.

The locale stays out of the main entry (size-limit budget per subpath + a
module-graph purity test), so hosts that never register it carry none of it.

Regenerated against bumped contract pins — auth v0.20.1, notifications v0.7.1,
billing v0.6.1, workspaces v0.22.1 (profiles was already pinned at v0.12.0,
which already carried its catalogue). Besides the catalogues, those pins bring:

- **auth** — two new error codes, `error.403.privileged_account` and
  `error.403.registration_closed`; and the OTP `code` field's documented length
  goes 4 → 8 digits across the password/TOTP/disable-otp request bodies. In the
  emitted TypeScript this is a doc-comment change only (`maxLength` is a runtime
  validation, not a TS type), so no generated type moved.
- **workspaces** — one new error code, `error.503.profiles_not_configured`: the
  deployment-has-no-profiles-service half of the member-rename 503, distinct
  from `error.503.profiles_unavailable` (the call was made and failed).
- **notifications** — the push-token register/unregister permission is restated
  as `IsNotAnonymousUser`; OpenAPI description prose only.
- **billing** — nothing but the catalogue and the backend-version pin.

No path, method, field or type was added, removed or retyped in any pair's
generated `schema.ts`. `calendar-react` and `recordings-react` are deliberately
untouched: `stapel-calendar` and `stapel-recordings` ship no locale catalogues at
all (they have no Russian either), and a fabricated empty Spanish file would only
make the set look uniform.
