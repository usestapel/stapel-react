---
"@stapel/forms-react": minor
---

True to stapel-forms 0.4.0: gate the response writes on the projected capability, and stop drawing an outage as a denial.

**The floor moves, so this is a minor.** `manifest.json`'s backend contract goes
`>=0.2 <0.3` → `>=0.4 <0.5`. 0.4.0 asserts that a `403` and a workspaces outage
are distinguishable, and on an older server they are not — a host reading this
pair's behaviour against forms 0.3.x would be told something untrue about its
own deployment.

- **`forms.responses.manage` is gated, and NAMED.** stapel-forms 0.3.0 started
  projecting which capability gates which route (`docs/capabilities.json`,
  `x-stapel-capability` on all sixteen gated operations) — but no payload
  carries the caller's grants, so they are **provided rather than computed**:
  `createFormsRuntime({ capabilities })`, fed from `my_capabilities` in a tenant
  app or a session claim elsewhere. `<ResponsesPane>`'s override field and both
  write buttons now sit under ONE `GatedControl`, so a caller who lacks the
  capability sees the block switched off with the permission written beside it
  and `aria-describedby` linking all three controls to that one sentence.

  **Omitting `capabilities` gates nothing** — `judgeCapability` has three
  answers and `unknown` is not `denied`. A guessed "you may not" is the same
  defect as a dead button, and the server re-checks every request regardless.
  `capabilityMatches` is a port of the backend matcher, wildcards included.

- **The 503 arm exists, as a state of its own.** Core 0.47.0 gave
  `require_capability` a third answer, forms 0.4.0's `unavailable` branch fires,
  and a workspaces outage is now `503 error.503.forms_workspaces_unavailable`
  instead of a `403`. `classifyGateRefusal(error)` names which of the two you
  have — code first, status second, `null` for everything that is not the gate
  — and `<ResponsesPane>` draws them apart: the denial says which permission to
  ask for and offers **no** retry, the outage says it is on our side and offers
  one. Anything else keeps its own sentence, so a 500 is never relabelled as a
  permission problem.

- **The caveat is deleted, not softened.** Every line of this pair that repeated
  the retired contract warning — that the pair "does NOT pre-gate … the contract
  exposes none" and that a 403 might not be a verdict — is gone from
  `ResponsesPane`, the skin demo's description, README and MODULE.md. A stale
  caveat here would not be out of date, it would be false.

New public surface off the main entry: `FORMS_CAPABILITIES`,
`capabilityMatches`, `judgeCapability`, `useFormsCapability`,
`useFormsCapabilityGate`, `classifyGateRefusal`, `FORMS_FORBIDDEN`,
`FORMS_WORKSPACES_UNAVAILABLE`, and the `CapabilityVerdict` / `FormsCapability`
/ `GateRefusal` types. Three i18n keys in en+ru+es. Tests 160 → 168.
