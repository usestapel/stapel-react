---
"@stapel/auth-react": minor
---

Consumer-reported gap (meettoday migrators, real production incident): `bootstrapProbe()` silently no-op'd in bearer mode (`cookieMode: false`) whenever nothing was persisted locally — exactly the shape of a `session_share` QR scan, magic-link click, SSO, or OAuth callback, all of which mint fresh httponly JWT cookies via a plain HTTP redirect entirely outside this runtime. A bearer-mode host cold-loading afterwards had a perfectly valid server-side session and no way to discover it — it just looked logged out.

- **New runtime option `bootstrapProbe?: "auto" | "always" | "off"`** (`createAuthRuntime` and `createAuthSession`), default `"auto"`:
  - `"auto"` probes bearer mode when the non-httponly `stapel_auth_hint` cookie is present (a plain `document.cookie` check, SSR-safe) — this cookie is set by `stapel-auth ^0.7.6` alongside every httponly refresh cookie it mints, so a bearer host pays **zero** extra network calls on a cold load that never touched a cookie-minting flow (verified via a mock-fetch call-count assertion).
  - `"always"` probes bearer mode unconditionally, for backends that don't set the hint.
  - `"off"` reproduces the old silent bearer behavior, but now logs a one-time `console.warn` so this coverage gap can't recur invisibly.
  - Cookie mode (`cookieMode: true`) is unaffected — it already probed unconditionally and still does.
- A successful bearer-mode probe adopts the discovered session through the exact same `setTokens()` path a normal refresh uses — no separate bearer-mode adoption code, no new persistence (bearer mode still never writes tokens to storage).
- The refresh-only client built by `createAuthRuntime` now defaults its `credentials` to `"include"` **regardless of `cookieMode`** (previously bearer mode left it at the browser default, which silently drops cross-origin cookies) — this is what lets the probe's refresh call actually see the cookie jar. The main client's `credentials` default is unchanged (still `cookieMode`-gated). An explicit `credentials` option still overrides both clients identically.
- A genuine network/transport failure during any refresh attempt (not a clean 401) now logs a `console.warn` before settling anonymous — previously indistinguishable from "there was never a session".
- Fixed the `bootstrapProbe()`/`cookieMode` doc comments, which read as describing a cookie-mode-only mechanism and were the direct cause of a consumer removing their own workaround under the mistaken impression this was already a general fix.

See the package README's new "The bootstrap probe & `bootstrapProbe`" section for the full contract and an example.
