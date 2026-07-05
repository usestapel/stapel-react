---
"@stapel/auth-react": patch
---

Adversarial-review fixes (pre-release):

- **createFlowMachine staleness guard (R1).** `run` now captures a per-run epoch
  after parking in `pending` and only applies its terminal transition (and its
  resolve/reject side effects) if no newer `to` happened meanwhile. A stale
  result from a double-submit, cancel, navigate, or expiry can no longer clobber
  the newer state. The guard lives in the primitive so every future pair
  inherits it.
- **createFlowMachine re-entrancy (R2, frontier pass).** The staleness epoch is
  now captured atomically with the pending transition, BEFORE listeners are
  notified. Previously a subscriber that re-entrantly called `to()` from the
  pending notification advanced the generation before the run captured it, so
  the guard read the listener's epoch and the late result clobbered the
  re-entrant transition.
- **createFlowMachine mapper fault isolation (frontier pass).** A throwing
  `resolve` mapper is no longer mistaken for a task failure (which
  double-emitted `completed`+`failed` and applied a reject state built from the
  mapper's own exception) — the task's settlement is folded into data first;
  mapper/listener throws propagate loudly out of `run`.
- **Passkey prompt vs cancel/expiry (frontier pass).** A native WebAuthn prompt
  rejecting AFTER the challenge was cancelled or expired no longer resurrects
  the dead challenge UI as `factorError`.
- **Expiry timer int32 overflow (frontier pass).** A far-future `expires_at`
  (> ~24.8 days) no longer expires the challenge instantly (setTimeout folds
  overflowed delays to ~1ms); bounded timers are chained instead.
- **Cookie mode (frontier pass).** `createAuthRuntime({ cookieMode: true })`
  now defaults the client to `credentials: "include"` (overridable via the new
  `credentials` option) so HTTP-only JWT cookies actually ride cross-origin
  requests — including refresh and verification retries.
- **Verification controller lifecycle (A2).** The controller now self-releases
  the awaited core request on the envelope's `expires_at`: an abandoned modal
  resolves `{ retry: false }` instead of hanging the original request forever
  and wedging all future challenges. A factor whose `initiate` fails
  recoverably (e.g. a 423-locked factor) returns to the picker so a different
  factor stays choosable; only a 404 (challenge gone) ends the whole challenge.

Still NOT released — awaits final review sign-off.
