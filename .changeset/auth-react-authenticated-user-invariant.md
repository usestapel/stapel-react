---
"@stapel/auth-react": minor
---

Owner-diagnosed live incident (meettoday migrators, composes with the bearer-mode `bootstrapProbe` fix): `AuthSession` could settle into `{ status: "authenticated", user: null }` — an inconsistent state this library neither prevented nor documented. Path: bearer mode, only a QR-minted httponly cookie present. Cold load → `restore()` finds nothing locally → `bootstrapProbe()` → `sessionManager.refresh()` → `doRefresh()` → `setTokens()`, which spread the (still-null) prior `state.user` and hand-set `status: "authenticated"` regardless — only `adopt()` ever set `user`. A `ProtectedRoute` that correctly checks BOTH `status` and `user` (`!isAuthenticated || !user`) saw a contradiction and bounced a signed-in user back to login on every navigation.

Two layers, both shipped (documentation alone was explicitly not acceptable — the fix makes the illegal state unrepresentable):

- **`status` is now DERIVED, never hand-set.** Every state transition computes `status` from `user`/`tokens` via one internal `computeStatus()` — `{ status: "authenticated", user: null }` cannot be constructed through this module's public surface anymore, from any call site (this also closes the same shape of bug in `setTokens()`'s OTHER caller, `QrLogin.tsx`'s `login_request` fulfilment, which is token-only too).
- **`setTokens()` resolves the user before settling authenticated.** stapel-auth's `GET/POST /token/refresh/` returns tokens only (`TokenPairResponse`/`RefreshResponse` — access+refresh, never a user), so a bare token pair with no already-known user now calls `me()` (via the seam-free refresh client — safe to call from inside a refresh, no reentrancy) and only marks the session authenticated once a user comes back. If that resolution fails (dead tokens, network error), the tokens are cleared and the session settles unauthenticated instead of leaving a dangling, unconfirmed "authenticated" session — this never throws.
- `createAuthRuntime`'s dedicated refresh-only client now also carries a `getToken` (sourced from the session's own state) so this in-flight `me()` call authenticates correctly in bearer mode without reintroducing the `onAuthRefresh`-seam reentrancy the refresh-only client exists to avoid.
- `doRefresh`'s return value to core's `SessionManager` is now read back from what `setTokens()` actually settled, instead of a hardcoded `"authenticated"` — this also fixes a latent inconsistency where a guest (`is_anonymous`) token refresh would flip the core `SessionManager` back to `"authenticated"` a moment after `setTokens()` correctly called `markAnonymous()`.

See the README's new "The `status`/`user` invariant" section for the contract and a `ProtectedRoute` example.
