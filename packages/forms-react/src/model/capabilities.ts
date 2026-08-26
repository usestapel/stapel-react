/**
 * Who may do what — the capability axis stapel-forms PROJECTS, and the two
 * different refusals its gate can now produce.
 *
 * ── The projection ─────────────────────────────────────────────────────────
 *
 * stapel-forms 0.3.0 publishes its four workspace capabilities in
 * `docs/capabilities.json`, and stamps `x-stapel-capability` on each of the
 * sixteen gated operations — so the generated schema this pair compiles
 * against now says, per route, which string the server will ask workspaces
 * about. `FORMS_CAPABILITIES` is that vocabulary; nothing in this package
 * writes a `"forms.*"` literal anywhere else.
 *
 * What the contract projects is the MAPPING (route → capability), not the
 * caller's grants: no forms payload carries "and you hold these". So the
 * grants are PROVIDED, the way `@stapel/core`'s mandate axis is — the host
 * hands them to `createFormsRuntime({ capabilities })` from whatever already
 * knows (`my_capabilities` off `@stapel/workspaces-react`'s workspace detail
 * in a tenant app, a session claim elsewhere). This pair never learns what a
 * workspace membership is, and a public embed declares nothing at all.
 *
 * `undefined` is therefore a THIRD answer and not an empty grant list:
 *
 *  - `granted` — the projection contains the string. Offer the control.
 *  - `denied`  — the host declared its grants and this one is not among them.
 *    Switch the control off and NAME the capability: a person who is told
 *    which permission they lack can go and ask for it.
 *  - `unknown` — nobody said. Leave the control live and let the server
 *    answer; a guessed "you may not" is the same defect as a dead button.
 *
 * A client-side verdict is a UI convenience and never an access decision —
 * the backend re-checks every capability on every request.
 *
 * ── The two refusals ───────────────────────────────────────────────────────
 *
 * Until stapel-forms 0.4.0 a 403 from a gated route meant either "not
 * granted" or "the workspaces service could not be asked", and the contract
 * said so in every `capabilities[].gates.behavior`. Core 0.47.0 gave
 * `require_capability` a third answer, so the module's `unavailable` branch
 * fires and the caveat is GONE from the contract: a 403 is now a verdict that
 * may be treated as one, and an outage arrives as
 * `503 error.503.forms_workspaces_unavailable`, which is "ask again".
 *
 * {@link classifyGateRefusal} is where this pair spends that: the two get
 * different copy, and only the retryable one gets a retry.
 */
import { useMemo } from "react";
import {
  actionAvailable,
  actionBlocked,
  errorCode,
  isStapelApiError,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";
import { useFormsRuntime } from "./context.js";

/**
 * The capability strings stapel-forms enforces, exactly as
 * `docs/capabilities.json` publishes them.
 */
export const FORMS_CAPABILITIES = {
  /** Read the form catalogue and the published version history. */
  view: "forms.view",
  /** Author, publish, rename, rotate, open/close and soft-delete forms. */
  manage: "forms.manage",
  /** Read stored responses and export them. */
  responsesView: "forms.responses.view",
  /** Delete one response, or re-send it. The destructive half. */
  responsesManage: "forms.responses.manage",
} as const;

export type FormsCapability =
  (typeof FORMS_CAPABILITIES)[keyof typeof FORMS_CAPABILITIES];

/** Granted, refused, or not knowable here. Never two of these collapsed. */
export type CapabilityVerdict = "granted" | "denied" | "unknown";

/**
 * Match one granted string against a requested capability: an exact string,
 * the global wildcard `"*"`, or a prefix wildcard like `"forms.*"` (which
 * matches `forms.manage` AND the deeper `forms.responses.manage`).
 *
 * KEEP IN SYNC with stapel-workspaces' `capability_matches` — wildcard
 * semantics are a protocol, and this is the third implementation of it in the
 * fleet (the backend's, `@stapel/workspaces-react`'s port, and this one). It
 * is copied rather than imported because a public forms embed must not pull
 * the multi-tenant metaphor in to answer one boolean; lifting the rule into
 * `@stapel/core` beside the mandate seam is filed as REQUESTS §8.
 */
export function capabilityMatches(capability: string, granted: string): boolean {
  if (granted === "*" || granted === capability) return true;
  if (granted.endsWith(".*")) return capability.startsWith(granted.slice(0, -1));
  return false;
}

/**
 * The verdict a declared grant list gives for one capability.
 * `undefined` grants are `"unknown"`, an empty array is a real `"denied"` —
 * a host that says "this person holds nothing" has said something.
 */
export function judgeCapability(
  granted: readonly string[] | undefined,
  capability: string
): CapabilityVerdict {
  if (granted === undefined) return "unknown";
  return granted.some((entry) => capabilityMatches(capability, entry))
    ? "granted"
    : "denied";
}

/** The refusal a forms route can answer with, once the two are told apart. */
export type GateRefusal =
  /** A VERDICT: workspaces was asked and said no. Cacheable, not retryable. */
  | "denied"
  /** The question could not be asked. On our side, and worth retrying. */
  | "unavailable";

/** stapel-forms' own outage key — 503, added to the wire by 0.4.0. */
export const FORMS_WORKSPACES_UNAVAILABLE =
  "error.503.forms_workspaces_unavailable";

/** stapel-forms' own denial key — 403, and since 0.4.0 nothing else. */
export const FORMS_FORBIDDEN = "error.403.forms_forbidden";

/**
 * Which of the gate's two answers is this, if either?
 *
 * Matched on the CODE first and the status second: the code is the contract's
 * own name for the outcome, and a status alone would fold every other 403 (a
 * verification step-up, a blocked network) into "you lack a capability".
 * Anything else is `null` — not every failure is the gate, and pretending
 * otherwise would relabel a 500 as a permission problem.
 */
export function classifyGateRefusal(caught: unknown): GateRefusal | null {
  const code = errorCode(caught);
  if (code === FORMS_WORKSPACES_UNAVAILABLE) return "unavailable";
  if (code === FORMS_FORBIDDEN) return "denied";
  if (!isStapelApiError(caught)) return null;
  if (caught.status === 503) return "unavailable";
  return null;
}

// ── the hooks a surface reads ────────────────────────────────────────────────

/**
 * The caller's verdict for one capability, from the grants the host declared
 * on the runtime. `"unknown"` with nothing declared — see the header: the
 * absence of a projection is not a refusal.
 */
export function useFormsCapability(capability: string): CapabilityVerdict {
  const runtime = useFormsRuntime();
  return judgeCapability(runtime.capabilities, capability);
}

/**
 * The same verdict as an {@link ActionAvailability}, ready for `GatedControl`
 * / `GatedButton`: blocked ONLY on `"denied"`, and the block names the
 * capability so the sentence beside the control is actionable rather than a
 * bare "you may not".
 */
export function useFormsCapabilityGate(capability: string): ActionAvailability {
  const verdict = useFormsCapability(capability);
  return useMemo(
    () =>
      verdict === "denied"
        ? actionBlocked(FORMS_I18N_KEYS.blockedCapability, { capability })
        : actionAvailable(),
    [verdict, capability]
  );
}
